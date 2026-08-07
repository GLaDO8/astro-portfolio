import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import metricsFixture from "./fixtures/metrics.json?raw";
import workoutsFixture from "./fixtures/workouts.json?raw";

const ENDPOINT = "https://health.example/v1/ingest/health-auto-export";
const TOKEN = "synthetic-test-token";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function request(
	body: BodyInit | null = metricsFixture,
	headers: HeadersInit = {},
	method = "POST",
): Request<unknown, IncomingRequestCfProperties> {
	return new IncomingRequest(ENDPOINT, {
		method,
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"content-type": "application/json",
			"automation-id": "metrics/daily",
			"session-id": "session:001",
			...headers,
		},
		body,
	});
}

async function dispatch(
	input: Request<unknown, IncomingRequestCfProperties>,
	testEnv: Env = env,
): Promise<Response> {
	return worker.fetch(input, testEnv);
}

async function clearBucket(): Promise<void> {
	const listed = await env.HEALTH_RAW.list();
	if (listed.objects.length > 0) {
		await env.HEALTH_RAW.delete(listed.objects.map(({ key }) => key));
	}
}

async function archivedKeys(): Promise<string[]> {
	const listed = await env.HEALTH_RAW.list({ prefix: "raw/health-auto-export/" });
	return listed.objects.map(({ key }) => key);
}

beforeEach(async () => {
	vi.restoreAllMocks();
	await clearBucket();
});

describe("health ingestion routing and validation", () => {
	it("retains the existing health route", async () => {
		const response = await dispatch(new IncomingRequest("https://health.example/health"));
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("matches the ingest route and POST method exactly", async () => {
		const wrongMethod = await dispatch(request(null, {}, "GET"));
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("POST");

		const wrongPath = await dispatch(new IncomingRequest(`${ENDPOINT}/extra`, { method: "POST" }));
		expect(wrongPath.status).toBe(404);
	});

	it.each([null, "Basic abc", "Bearer wrong-token"])(
		"rejects invalid authorization: %s",
		async (authorization) => {
			const headers = new Headers(request().headers);
			if (authorization === null) headers.delete("authorization");
			else headers.set("authorization", authorization);

			const response = await dispatch(
				new IncomingRequest(ENDPOINT, { method: "POST", headers, body: metricsFixture }),
			);
			expect(response.status).toBe(401);
			expect(await archivedKeys()).toEqual([]);
		},
	);

	it("requires JSON content type", async () => {
		const response = await dispatch(request(metricsFixture, { "content-type": "text/plain" }));
		expect(response.status).toBe(415);
		expect(await archivedKeys()).toEqual([]);
	});

	it.each(["automation-id", "session-id"])("requires a non-blank %s", async (name) => {
		const response = await dispatch(request(metricsFixture, { [name]: "   " }));
		expect(response.status).toBe(400);
		expect(await archivedKeys()).toEqual([]);
	});

	it("rejects an empty body", async () => {
		const response = await dispatch(request(""));
		expect(response.status).toBe(400);
		expect(await archivedKeys()).toEqual([]);
	});

	it("rejects an oversized declared content length before storage", async () => {
		const response = await dispatch(
			request("{}", { "content-length": String(MAX_BODY_BYTES + 1) }),
		);
		expect(response.status).toBe(413);
		expect(await archivedKeys()).toEqual([]);
	});

	it("enforces the size limit while streaming", async () => {
		const chunk = new Uint8Array(1024 * 1024);
		let remaining = 26;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (remaining === 0) controller.close();
				else {
					controller.enqueue(chunk);
					remaining -= 1;
				}
			},
		});

		const response = await dispatch(request(body));
		expect(response.status).toBe(413);
		expect(await archivedKeys()).toEqual([]);
	});
});

describe("raw archive contract", () => {
	it.each([
		["metrics", metricsFixture],
		["workouts", workoutsFixture],
	])("archives the synthetic %s fixture byte-for-byte", async (_name, fixture) => {
		const response = await dispatch(
			request(fixture, {
				"content-length": String(new TextEncoder().encode(fixture).byteLength),
				"content-type": "Application/JSON; charset=utf-8",
				"automation-name": "Synthetic export",
				"automation-aggregation": "daily",
				"automation-period": "since-last-sync",
				"content-encoding": "identity",
			}),
		);
		const result = await response.json<{
			ingest_id: string;
			raw_key: string;
			status: string;
		}>();

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(result.status).toBe("archived");
		expect(result.ingest_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(result.raw_key).toMatch(
			/^raw\/health-auto-export\/\d{4}\/\d{2}\/\d{2}\/[^/]+-metrics-daily-session-001-[0-9a-f-]{36}\.json$/,
		);

		const object = await env.HEALTH_RAW.get(result.raw_key);
		expect(object).not.toBeNull();
		expect(await object?.text()).toBe(fixture);
		expect(object?.customMetadata).toMatchObject({
			automation_id: "metrics/daily",
			session_id: "session:001",
			automation_name: "Synthetic export",
			automation_aggregation: "daily",
			automation_period: "since-last-sync",
			content_encoding: "identity",
			ingest_id: result.ingest_id,
		});
		expect(object?.customMetadata).not.toHaveProperty("payload");
	});

	it("creates a new immutable object for every delivery", async () => {
		const first = await (await dispatch(request())).json<{ raw_key: string }>();
		const second = await (await dispatch(request())).json<{ raw_key: string }>();

		expect(first.raw_key).not.toBe(second.raw_key);
		expect(await archivedKeys()).toHaveLength(2);
	});

	it("does not access D1 while ingesting", async () => {
		const noD1Env: Env = {
			HEALTH_INGEST_TOKEN: TOKEN,
			HEALTH_RAW: env.HEALTH_RAW,
			HEALTH_DB: new Proxy({} as D1Database, {
				get() {
					throw new Error("D1 must not be accessed during ingestion");
				},
			}),
		};

		const response = await dispatch(request(), noD1Env);
		expect(response.status).toBe(200);
	});

	it("returns a generic 5xx response when R2 rejects the write", async () => {
		const failingBucket: R2Bucket = new Proxy(env.HEALTH_RAW, {
			get(target, property, receiver) {
				if (property === "put") {
					return async (
						_key: string,
						value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
					) => {
						if (value instanceof ReadableStream) {
							await new Response(value).arrayBuffer();
						}
						throw new Error("synthetic R2 failure");
					};
				}

				return Reflect.get(target, property, receiver);
			},
		});
		const failingEnv: Env = {
			HEALTH_INGEST_TOKEN: TOKEN,
			HEALTH_RAW: failingBucket,
			HEALTH_DB: env.HEALTH_DB,
		};
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const response = await dispatch(
			request(metricsFixture, {
				"content-length": String(new TextEncoder().encode(metricsFixture).byteLength),
			}),
			failingEnv,
		);
		expect(response.status).toBeGreaterThanOrEqual(500);
		expect(await response.json()).toEqual({ error: "Archive unavailable" });
	});

	it("never writes health values or credentials to logs", async () => {
		const payload = JSON.stringify({ metric: "PRIVATE-METRIC", gps: "PRIVATE-GPS" });
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const response = await dispatch(request(payload));
		expect(response.status).toBe(200);

		const output = [...log.mock.calls, ...error.mock.calls].flat().join(" ");
		expect(output).not.toContain("PRIVATE-METRIC");
		expect(output).not.toContain("PRIVATE-GPS");
		expect(output).not.toContain(TOKEN);
	});
});
