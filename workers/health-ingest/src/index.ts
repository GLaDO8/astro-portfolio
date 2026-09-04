const JSON_HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
};

const INGEST_PATH = "/v1/ingest/health-auto-export";
const COUNT_PATH = "/v1/log/count";
const GRIP_STRENGTH_PATH = "/v1/log/grip-strength";
const MAX_BODY_BYTES = 90 * 1024 * 1024;
const MAX_LOG_BODY_BYTES = 8 * 1024;
const MULTIPART_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_KEY_SEGMENT_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 256;

type BodyViolation = "empty" | "too-large";

type BodyLimitState = {
	bytesRead: number;
	violation?: BodyViolation;
};

type ObservationTime = {
	localDate: string;
	observedAtMs: number;
	utcOffsetMinutes: number;
};

type CountObservation = ObservationTime & {
	count: number;
	idempotencyKey: string;
	type: string;
};

type CountEventRow = {
	count_value: number;
	count_type: string;
	id: string;
	idempotency_key: string;
	local_date: string;
	observed_at_ms: number;
	utc_offset_minutes: number;
};

type GripStrengthObservation = ObservationTime & {
	gripStrengthLeft: number;
	gripStrengthRight: number;
	idempotencyKey: string;
	unit: "kg" | "lb";
};

type MeasurementEventRow = {
	grip_strength_left: number;
	grip_strength_right: number;
	id: string;
	idempotency_key: string;
	local_date: string;
	measurement_type: string;
	observed_at_ms: number;
	unit: string;
	utc_offset_minutes: number;
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

function countRejected(error: string, status: number, reason: string): Response {
	console.warn({
		event: "count_log.rejected",
		message: "Count logging request rejected",
		reason,
		status,
	});
	return json({ error }, status);
}

function measurementRejected(error: string, status: number, reason: string): Response {
	console.warn({
		event: "measurement_log.rejected",
		message: "Measurement logging request rejected",
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

async function readBoundedJson(request: Request): Promise<unknown> {
	if (request.body === null) throw new Error("invalid_json");

	const limited = limitBody(request.body, MAX_LOG_BODY_BYTES);
	try {
		return await new Response(limited.stream).json();
	} catch {
		if (limited.state.violation === "too-large") throw new Error("body_too_large");
		throw new Error("invalid_json");
	}
}

function parseObservedAt(value: unknown): ObservationTime | null {
	if (typeof value !== "string") return null;

	const match =
		/^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/.exec(
			value,
		);
	if (match === null) return null;

	const [, year, month, day, zone, sign, offsetHour, offsetMinute] = match;
	const observedAtMs = Date.parse(value);
	if (!Number.isFinite(observedAtMs)) return null;
	const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
	if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth) {
		return null;
	}

	const utcOffsetMinutes =
		zone === "Z" ? 0 : (sign === "+" ? 1 : -1) * (Number(offsetHour) * 60 + Number(offsetMinute));

	return {
		localDate: `${year}-${month}-${day}`,
		observedAtMs,
		utcOffsetMinutes,
	};
}

function parseMeasurementValue(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) && value >= 0 && value <= 1000 ? value : null;
	}
	if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,3})(?:\.\d+)?$/.test(value)) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed <= 1000 ? parsed : null;
}

function parseGripStrengthObservation(value: unknown): GripStrengthObservation | Response {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return measurementRejected("Invalid JSON object", 400, "invalid_object");
	}

	const body = value as Record<string, unknown>;
	const gripStrengthLeft = parseMeasurementValue(body.grip_strength_left);
	if (gripStrengthLeft === null) {
		return measurementRejected("Invalid grip_strength_left", 400, "invalid_grip_strength_left");
	}
	const gripStrengthRight = parseMeasurementValue(body.grip_strength_right);
	if (gripStrengthRight === null) {
		return measurementRejected("Invalid grip_strength_right", 400, "invalid_grip_strength_right");
	}
	if (body.unit !== "kg" && body.unit !== "lb") {
		return measurementRejected("Invalid unit", 400, "invalid_unit");
	}

	const observedAt = parseObservedAt(body.observed_at);
	if (observedAt === null) {
		return measurementRejected("Invalid observed_at", 400, "invalid_observed_at");
	}
	if (
		typeof body.idempotency_key !== "string" ||
		!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(body.idempotency_key)
	) {
		return measurementRejected("Invalid idempotency_key", 400, "invalid_idempotency_key");
	}

	return {
		gripStrengthLeft,
		gripStrengthRight,
		idempotencyKey: body.idempotency_key,
		...observedAt,
		unit: body.unit,
	};
}

function parseCountObservation(value: unknown): CountObservation | Response {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return countRejected("Invalid JSON object", 400, "invalid_object");
	}

	const body = value as Record<string, unknown>;
	if (typeof body.type !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(body.type)) {
		return countRejected("Invalid type", 400, "invalid_type");
	}
	if (!Number.isSafeInteger(body.count) || (body.count as number) < 0) {
		return countRejected("Invalid count", 400, "invalid_count");
	}

	const observedAt = parseObservedAt(body.observed_at);
	if (observedAt === null) {
		return countRejected("Invalid observed_at", 400, "invalid_observed_at");
	}
	if (
		typeof body.idempotency_key !== "string" ||
		!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(body.idempotency_key)
	) {
		return countRejected("Invalid idempotency_key", 400, "invalid_idempotency_key");
	}

	return {
		count: body.count as number,
		idempotencyKey: body.idempotency_key,
		...observedAt,
		type: body.type,
	};
}

function isSameCountEvent(row: CountEventRow, observation: CountObservation): boolean {
	return (
		row.count_type === observation.type &&
		row.count_value === observation.count &&
		row.observed_at_ms === observation.observedAtMs &&
		row.local_date === observation.localDate &&
		row.utc_offset_minutes === observation.utcOffsetMinutes &&
		row.idempotency_key === observation.idempotencyKey
	);
}

function isSameMeasurementEvent(
	row: MeasurementEventRow,
	observation: GripStrengthObservation,
): boolean {
	return (
		row.measurement_type === "grip_strength" &&
		row.grip_strength_left === observation.gripStrengthLeft &&
		row.grip_strength_right === observation.gripStrengthRight &&
		row.unit === observation.unit &&
		row.observed_at_ms === observation.observedAtMs &&
		row.local_date === observation.localDate &&
		row.utc_offset_minutes === observation.utcOffsetMinutes &&
		row.idempotency_key === observation.idempotencyKey
	);
}

async function logCount(request: Request, env: Env): Promise<Response> {
	if (!(await isAuthorized(request, env.HEALTH_INGEST_TOKEN))) {
		return countRejected("Unauthorized", 401, "unauthorized");
	}
	if (!isJson(request)) {
		return countRejected("Content-Type must be application/json", 415, "unsupported_content_type");
	}

	const contentLength = request.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_LOG_BODY_BYTES) {
		return countRejected("Request body too large", 413, "body_too_large");
	}

	let body: unknown;
	try {
		body = await readBoundedJson(request);
	} catch (error) {
		if (error instanceof Error && error.message === "body_too_large") {
			return countRejected("Request body too large", 413, "body_too_large");
		}
		return countRejected("Invalid JSON", 400, "invalid_json");
	}

	const observation = parseCountObservation(body);
	if (observation instanceof Response) return observation;

	const countEventId = crypto.randomUUID();
	try {
		const insert = await env.HEALTH_DB.prepare(
			`INSERT INTO count_events (
				id, count_type, count_value, observed_at_ms, local_date,
				utc_offset_minutes, recorded_at_ms, idempotency_key
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(idempotency_key) DO NOTHING`,
		)
			.bind(
				countEventId,
				observation.type,
				observation.count,
				observation.observedAtMs,
				observation.localDate,
				observation.utcOffsetMinutes,
				Date.now(),
				observation.idempotencyKey,
			)
			.run();

		if (insert.meta.changes === 1) {
			console.log({ event: "count_log.created", message: "Count observation stored" });
			return json({ count_event_id: countEventId, status: "created" }, 201);
		}

		const existing = await env.HEALTH_DB.prepare(
			`SELECT id, count_type, count_value, observed_at_ms, local_date,
				utc_offset_minutes, idempotency_key
			FROM count_events WHERE idempotency_key = ?`,
		)
			.bind(observation.idempotencyKey)
			.first<CountEventRow>();

		if (existing !== null && isSameCountEvent(existing, observation)) {
			console.log({ event: "count_log.duplicate", message: "Count observation already stored" });
			return json({ count_event_id: existing.id, status: "duplicate" });
		}
		if (existing !== null) {
			return countRejected("Idempotency key conflict", 409, "idempotency_conflict");
		}

		throw new Error("Count insert was ignored without an idempotency match");
	} catch (error) {
		console.error({
			event: "count_log.write_failed",
			message: "Count observation write failed",
			error_type: error instanceof Error ? error.name : "UnknownError",
		});
		return json({ error: "Count storage unavailable" }, 500);
	}
}

async function logGripStrength(request: Request, env: Env): Promise<Response> {
	if (!(await isAuthorized(request, env.HEALTH_INGEST_TOKEN))) {
		return measurementRejected("Unauthorized", 401, "unauthorized");
	}
	if (!isJson(request)) {
		return measurementRejected(
			"Content-Type must be application/json",
			415,
			"unsupported_content_type",
		);
	}

	const contentLength = request.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_LOG_BODY_BYTES) {
		return measurementRejected("Request body too large", 413, "body_too_large");
	}

	let body: unknown;
	try {
		body = await readBoundedJson(request);
	} catch (error) {
		if (error instanceof Error && error.message === "body_too_large") {
			return measurementRejected("Request body too large", 413, "body_too_large");
		}
		return measurementRejected("Invalid JSON", 400, "invalid_json");
	}

	const observation = parseGripStrengthObservation(body);
	if (observation instanceof Response) return observation;

	const measurementEventId = crypto.randomUUID();
	try {
		const insert = await env.HEALTH_DB.prepare(
			`INSERT INTO measurement_events (
				id, measurement_type, grip_strength_left, grip_strength_right, unit,
				observed_at_ms, local_date, utc_offset_minutes, recorded_at_ms, idempotency_key
			) VALUES (?, 'grip_strength', ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(idempotency_key) DO NOTHING`,
		)
			.bind(
				measurementEventId,
				observation.gripStrengthLeft,
				observation.gripStrengthRight,
				observation.unit,
				observation.observedAtMs,
				observation.localDate,
				observation.utcOffsetMinutes,
				Date.now(),
				observation.idempotencyKey,
			)
			.run();

		if (insert.meta.changes === 1) {
			console.log({ event: "measurement_log.created", message: "Measurement observation stored" });
			return json({ measurement_event_id: measurementEventId, status: "created" }, 201);
		}

		const existing = await env.HEALTH_DB.prepare(
			`SELECT id, measurement_type, grip_strength_left, grip_strength_right, unit,
				observed_at_ms, local_date, utc_offset_minutes, idempotency_key
			FROM measurement_events WHERE idempotency_key = ?`,
		)
			.bind(observation.idempotencyKey)
			.first<MeasurementEventRow>();

		if (existing !== null && isSameMeasurementEvent(existing, observation)) {
			console.log({
				event: "measurement_log.duplicate",
				message: "Measurement observation already stored",
			});
			return json({ measurement_event_id: existing.id, status: "duplicate" });
		}
		if (existing !== null) {
			return measurementRejected("Idempotency key conflict", 409, "idempotency_conflict");
		}

		throw new Error("Measurement insert was ignored without an idempotency match");
	} catch (error) {
		console.error({
			event: "measurement_log.write_failed",
			message: "Measurement observation write failed",
			error_type: error instanceof Error ? error.name : "UnknownError",
		});
		return json({ error: "Measurement storage unavailable" }, 500);
	}
}

function limitBody(
	body: ReadableStream<Uint8Array>,
	maxBytes = MAX_BODY_BYTES,
): {
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
			if (state.bytesRead > maxBytes) {
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

		if (url.pathname === COUNT_PATH) {
			if (request.method !== "POST") {
				return json({ error: "Method not allowed" }, 405, { allow: "POST" });
			}

			return logCount(request, env);
		}

		if (url.pathname === GRIP_STRENGTH_PATH) {
			if (request.method !== "POST") {
				return json({ error: "Method not allowed" }, 405, { allow: "POST" });
			}

			return logGripStrength(request, env);
		}

		return json({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;
