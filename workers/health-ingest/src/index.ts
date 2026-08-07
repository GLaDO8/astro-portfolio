const JSON_HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
};

const INGEST_PATH = "/v1/ingest/health-auto-export";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MULTIPART_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_KEY_SEGMENT_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 256;

type BodyViolation = "empty" | "too-large";

type BodyLimitState = {
	bytesRead: number;
	violation?: BodyViolation;
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		status,
		headers: { ...JSON_HEADERS, ...headers },
	});
}

function rejected(error: string, status: number, reason: string): Response {
	console.warn({
		event: "health_ingest.rejected",
		message: "Health ingestion request rejected",
		reason,
		status,
	});
	return json({ error }, status);
}

function boundedHeader(request: Request, name: string): string | undefined {
	const value = request.headers.get(name)?.trim();
	return value ? value.slice(0, MAX_METADATA_VALUE_LENGTH) : undefined;
}

function sanitizeKeySegment(value: string): string {
	const sanitized = value
		.normalize("NFKC")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^[._-]+|[._-]+$/g, "")
		.slice(0, MAX_KEY_SEGMENT_LENGTH);

	return sanitized || "unknown";
}

async function isAuthorized(request: Request, expectedToken: string): Promise<boolean> {
	const authorization = request.headers.get("authorization") ?? "";
	const match = /^Bearer ([^\s]+)$/.exec(authorization);
	const candidate = match?.[1] ?? "";
	const encoder = new TextEncoder();
	const [candidateDigest, expectedDigest] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
		crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
	]);

	return match !== null && crypto.subtle.timingSafeEqual(candidateDigest, expectedDigest);
}

function isJson(request: Request): boolean {
	const contentType = request.headers.get("content-type");
	return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function limitBody(body: ReadableStream<Uint8Array>): {
	stream: ReadableStream<Uint8Array>;
	state: BodyLimitState;
} {
	const reader = body.getReader();
	const state: BodyLimitState = { bytesRead: 0 };

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				if (state.bytesRead === 0) {
					state.violation = "empty";
					controller.error(new Error("Empty request body"));
				} else {
					controller.close();
				}
				return;
			}

			state.bytesRead += value.byteLength;
			if (state.bytesRead > MAX_BODY_BYTES) {
				state.violation = "too-large";
				await reader.cancel("Request body exceeds the ingestion limit");
				controller.error(new Error("Request body too large"));
				return;
			}

			controller.enqueue(value);
		},
		async cancel(reason) {
			await reader.cancel(reason);
		},
	});

	return { stream, state };
}

async function putFixedLengthBody(
	bucket: R2Bucket,
	key: string,
	body: ReadableStream<Uint8Array>,
	declaredBytes: number,
	options: R2PutOptions,
	state: BodyLimitState,
): Promise<void> {
	const limited = limitBody(body);
	const fixedLength = new FixedLengthStream(declaredBytes);
	const [putResult, pipeResult] = await Promise.allSettled([
		bucket.put(key, fixedLength.readable, options),
		limited.stream.pipeTo(fixedLength.writable),
	]);
	state.bytesRead = limited.state.bytesRead;
	state.violation = limited.state.violation;

	if (putResult.status === "rejected") throw putResult.reason;
	if (pipeResult.status === "rejected") throw pipeResult.reason;
}

async function putMultipartBody(
	bucket: R2Bucket,
	key: string,
	body: ReadableStream<Uint8Array>,
	options: R2MultipartOptions,
	state: BodyLimitState,
): Promise<void> {
	const upload = await bucket.createMultipartUpload(key, options);
	const reader = body.getReader();
	const parts: R2UploadedPart[] = [];
	let buffer = new Uint8Array(MULTIPART_CHUNK_BYTES);
	let bufferedBytes = 0;
	let completed = false;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			state.bytesRead += value.byteLength;
			if (state.bytesRead > MAX_BODY_BYTES) {
				state.violation = "too-large";
				await reader.cancel("Request body exceeds the ingestion limit");
				throw new Error("Request body too large");
			}

			let offset = 0;
			while (offset < value.byteLength) {
				const bytesToCopy = Math.min(
					MULTIPART_CHUNK_BYTES - bufferedBytes,
					value.byteLength - offset,
				);
				buffer.set(value.subarray(offset, offset + bytesToCopy), bufferedBytes);
				bufferedBytes += bytesToCopy;
				offset += bytesToCopy;

				if (bufferedBytes === MULTIPART_CHUNK_BYTES) {
					parts.push(await upload.uploadPart(parts.length + 1, buffer));
					buffer = new Uint8Array(MULTIPART_CHUNK_BYTES);
					bufferedBytes = 0;
				}
			}
		}

		if (state.bytesRead === 0) {
			state.violation = "empty";
			throw new Error("Empty request body");
		}

		if (bufferedBytes > 0) {
			parts.push(await upload.uploadPart(parts.length + 1, buffer.slice(0, bufferedBytes)));
		}
		await upload.complete(parts);
		completed = true;
	} finally {
		if (!completed) {
			try {
				await upload.abort();
			} catch {
				// Preserve the ingestion failure that triggered the abort.
			}
		}
	}
}

function buildMetadata(
	request: Request,
	automationId: string,
	sessionId: string,
	ingestId: string,
	receivedAt: string,
): Record<string, string> {
	const metadata: Record<string, string> = {
		automation_id: automationId.slice(0, MAX_METADATA_VALUE_LENGTH),
		session_id: sessionId.slice(0, MAX_METADATA_VALUE_LENGTH),
		ingest_id: ingestId,
		received_at: receivedAt,
	};
	const optionalHeaders = {
		automation_name: "automation-name",
		automation_aggregation: "automation-aggregation",
		automation_period: "automation-period",
		content_encoding: "content-encoding",
	};

	for (const [metadataName, headerName] of Object.entries(optionalHeaders)) {
		const value = boundedHeader(request, headerName);
		if (value !== undefined) metadata[metadataName] = value;
	}

	return metadata;
}

async function archive(request: Request, env: Env): Promise<Response> {
	if (!(await isAuthorized(request, env.HEALTH_INGEST_TOKEN))) {
		return rejected("Unauthorized", 401, "unauthorized");
	}

	if (!isJson(request)) {
		return rejected("Content-Type must be application/json", 415, "unsupported_content_type");
	}

	const automationId = request.headers.get("automation-id")?.trim();
	const sessionId = request.headers.get("session-id")?.trim();
	if (!automationId || !sessionId) {
		return rejected("automation-id and session-id are required", 400, "missing_source_headers");
	}

	const contentLength = request.headers.get("content-length");
	let declaredBytes: number | undefined;
	if (contentLength && /^\d+$/.test(contentLength)) {
		declaredBytes = Number(contentLength);
		if (declaredBytes === 0) return rejected("Request body is empty", 400, "empty_body");
		if (declaredBytes > MAX_BODY_BYTES) {
			return rejected("Request body too large", 413, "body_too_large");
		}
	}

	if (request.body === null) {
		return rejected("Request body is empty", 400, "empty_body");
	}

	const ingestId = crypto.randomUUID();
	const receivedAt = new Date().toISOString();
	const rawKey = `${sanitizeKeySegment(receivedAt)}-${sanitizeKeySegment(automationId)}-${sanitizeKeySegment(sessionId)}-${ingestId}.json`;
	const state: BodyLimitState = { bytesRead: 0 };
	const storageOptions = {
		httpMetadata: { contentType: "application/json" },
		customMetadata: buildMetadata(request, automationId, sessionId, ingestId, receivedAt),
	};

	try {
		if (declaredBytes === undefined) {
			await putMultipartBody(env.HEALTH_RAW, rawKey, request.body, storageOptions, state);
		} else {
			await putFixedLengthBody(
				env.HEALTH_RAW,
				rawKey,
				request.body,
				declaredBytes,
				storageOptions,
				state,
			);
		}
	} catch (error) {
		if (state.violation === "empty") {
			return rejected("Request body is empty", 400, "empty_body");
		}
		if (state.violation === "too-large") {
			return rejected("Request body too large", 413, "body_too_large");
		}
		if (declaredBytes !== undefined && state.bytesRead !== declaredBytes) {
			return rejected("Content-Length does not match request body", 400, "content_length_mismatch");
		}

		console.error({
			event: "health_ingest.archive_failed",
			message: "Raw health archive failed",
			ingest_id: ingestId,
			raw_key: rawKey,
			error_type: error instanceof Error ? error.name : "UnknownError",
		});
		return json({ error: "Archive unavailable" }, 500);
	}

	console.log({
		event: "health_ingest.archived",
		message: "Raw health request archived",
		ingest_id: ingestId,
		raw_key: rawKey,
		bytes: state.bytesRead,
	});

	return json({ ingest_id: ingestId, raw_key: rawKey, status: "archived" });
}

async function checkBindings(env: Env): Promise<Response> {
	try {
		const [databaseResult] = await Promise.all([
			env.HEALTH_DB.prepare("SELECT 1 AS healthy").first<{ healthy: number }>(),
			env.HEALTH_RAW.head("__healthcheck__"),
		]);

		if (databaseResult?.healthy !== 1) {
			throw new Error("D1 health check returned an unexpected result");
		}

		console.log({
			event: "health_ingest.health_ok",
			message: "Cloudflare bindings are healthy",
		});
		return json({ status: "ok" });
	} catch (error) {
		console.error({
			event: "health_ingest.health_check_failed",
			message: "Cloudflare binding health check failed",
			error: error instanceof Error ? error.message : String(error),
		});

		return json({ status: "unavailable" }, 503);
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			if (request.method !== "GET") {
				return json({ error: "Method not allowed" }, 405, { allow: "GET" });
			}

			return checkBindings(env);
		}

		if (url.pathname === INGEST_PATH) {
			if (request.method !== "POST") {
				return json({ error: "Method not allowed" }, 405, { allow: "POST" });
			}

			return archive(request, env);
		}

		return json({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;
