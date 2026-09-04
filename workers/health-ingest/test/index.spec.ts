import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import countEventsMigration from "../migrations/health-auto-export/0004_count_events.sql?raw";
import measurementEventsMigration from "../migrations/health-auto-export/0005_measurement_events.sql?raw";
import worker from "../src/index";
import metricsFixture from "./fixtures/metrics.json?raw";
import workoutsFixture from "./fixtures/workouts.json?raw";

const ENDPOINT = "https://health.example/v1/ingest/health-auto-export";
const COUNT_ENDPOINT = "https://health.example/v1/log/count";
const GRIP_STRENGTH_ENDPOINT = "https://health.example/v1/log/grip-strength";
const TOKEN = "synthetic-test-token";
const MAX_BODY_BYTES = 90 * 1024 * 1024;
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
	const listed = await env.HEALTH_RAW.list();
	return listed.objects.map(({ key }) => key);
}

function countRequest(
	body: unknown = {
		count: 2,
		idempotency_key: "shortcut-run-001",
		observed_at: "2026-08-16T07:15:00+05:30",
		type: "nighttime_urination",
	},
	headers: HeadersInit = {},
	method = "POST",
): Request<unknown, IncomingRequestCfProperties> {
	return new IncomingRequest(COUNT_ENDPOINT, {
		method,
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"content-type": "application/json",
			...headers,
		},
		body: body === null ? null : JSON.stringify(body),
	});
}

function gripStrengthRequest(
	body: unknown = {
		grip_strength_left: "42.7",
		grip_strength_right: "44.1",
		idempotency_key: "shortcut-grip-run-001",
		observed_at: "2026-08-17T09:30:00+05:30",
		unit: "kg",
	},
	headers: HeadersInit = {},
	method = "POST",
): Request<unknown, IncomingRequestCfProperties> {
	return new IncomingRequest(GRIP_STRENGTH_ENDPOINT, {
		method,
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"content-type": "application/json",
			...headers,
		},
		body: body === null ? null : JSON.stringify(body),
	});
}

beforeAll(async () => {
	await applyD1Migrations(env.HEALTH_DB, [
		{ name: "0004_count_events.sql", queries: [countEventsMigration] },
		{ name: "0005_measurement_events.sql", queries: [measurementEventsMigration] },
	]);
});

beforeEach(async () => {
	vi.restoreAllMocks();
	await clearBucket();
	await env.HEALTH_DB.prepare("DELETE FROM count_events").run();
	await env.HEALTH_DB.prepare("DELETE FROM measurement_events").run();
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
		let remaining = 91;
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

	it("accepts a streamed body beyond the previous 25 MiB ceiling", async () => {
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
		expect(response.status).toBe(200);
		expect(await archivedKeys()).toHaveLength(1);
	});
});

describe("generic count logging", () => {
	it("requires POST and bearer authentication", async () => {
		const wrongMethod = await dispatch(countRequest(null, {}, "GET"));
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("POST");

		const unauthorized = await dispatch(countRequest(undefined, { authorization: "Bearer wrong" }));
		expect(unauthorized.status).toBe(401);
	});

	it("requires a small valid JSON request", async () => {
		const wrongType = await dispatch(countRequest(undefined, { "content-type": "text/plain" }));
		expect(wrongType.status).toBe(415);

		const malformed = await dispatch(
			new IncomingRequest(COUNT_ENDPOINT, {
				method: "POST",
				headers: {
					authorization: `Bearer ${TOKEN}`,
					"content-type": "application/json",
				},
				body: "{",
			}),
		);
		expect(malformed.status).toBe(400);
		expect(await malformed.json()).toEqual({ error: "Invalid JSON" });

		const oversized = await dispatch(
			countRequest(undefined, { "content-length": String(8 * 1024 + 1) }),
		);
		expect(oversized.status).toBe(413);
	});

	it.each([
		[{ count: 2, idempotency_key: "key", observed_at: "2026-08-16T07:15:00+05:30" }, "type"],
		[
			{
				count: 2,
				idempotency_key: "key",
				observed_at: "2026-08-16T07:15:00+05:30",
				type: "Night time",
			},
			"type",
		],
		[
			{
				count: -1,
				idempotency_key: "key",
				observed_at: "2026-08-16T07:15:00+05:30",
				type: "nighttime_urination",
			},
			"count",
		],
		[
			{
				count: 1.5,
				idempotency_key: "key",
				observed_at: "2026-08-16T07:15:00+05:30",
				type: "nighttime_urination",
			},
			"count",
		],
		[
			{
				count: 2,
				idempotency_key: "key",
				observed_at: "2026-08-16T07:15:00",
				type: "nighttime_urination",
			},
			"observed_at",
		],
		[
			{
				count: 2,
				idempotency_key: "",
				observed_at: "2026-08-16T07:15:00+05:30",
				type: "nighttime_urination",
			},
			"idempotency_key",
		],
	])("rejects an invalid payload field: %s", async (body, field) => {
		const response = await dispatch(countRequest(body));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: `Invalid ${field}` });
	});

	it("stores a count observation and its local time context", async () => {
		const response = await dispatch(countRequest());
		const result = await response.json<{ count_event_id: string; status: string }>();

		expect(response.status).toBe(201);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(result.status).toBe("created");
		expect(result.count_event_id).toMatch(/^[0-9a-f-]{36}$/);

		const row = await env.HEALTH_DB.prepare(
			"SELECT id, count_type, count_value, observed_at_ms, local_date, utc_offset_minutes, idempotency_key FROM count_events",
		).first();
		expect(row).toEqual({
			count_type: "nighttime_urination",
			count_value: 2,
			id: result.count_event_id,
			idempotency_key: "shortcut-run-001",
			local_date: "2026-08-16",
			observed_at_ms: Date.parse("2026-08-16T07:15:00+05:30"),
			utc_offset_minutes: 330,
		});
	});

	it("accepts zero as an observed count", async () => {
		const response = await dispatch(
			countRequest({
				count: 0,
				idempotency_key: "shortcut-run-zero",
				observed_at: "2026-08-17T07:15:00+05:30",
				type: "nighttime_urination",
			}),
		);

		expect(response.status).toBe(201);
		expect(
			await env.HEALTH_DB.prepare("SELECT count_value FROM count_events").first("count_value"),
		).toBe(0);
	});

	it("returns the original event for an exact retry", async () => {
		const first = await dispatch(countRequest());
		const second = await dispatch(countRequest());
		const firstResult = await first.json<{ count_event_id: string }>();
		const secondResult = await second.json<{ count_event_id: string; status: string }>();

		expect(first.status).toBe(201);
		expect(second.status).toBe(200);
		expect(secondResult).toEqual({
			count_event_id: firstResult.count_event_id,
			status: "duplicate",
		});
		expect(
			await env.HEALTH_DB.prepare("SELECT COUNT(*) AS count FROM count_events").first("count"),
		).toBe(1);
	});

	it("rejects reuse of an idempotency key with different data", async () => {
		await dispatch(countRequest());
		const response = await dispatch(
			countRequest({
				count: 3,
				idempotency_key: "shortcut-run-001",
				observed_at: "2026-08-16T07:15:00+05:30",
				type: "nighttime_urination",
			}),
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "Idempotency key conflict" });
	});

	it("does not expose count data in structured logs", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const response = await dispatch(countRequest());
		expect(response.status).toBe(201);

		const output = JSON.stringify(log.mock.calls);
		expect(output).not.toContain("nighttime_urination");
		expect(output).not.toContain("shortcut-run-001");
		expect(output).not.toContain("2026-08-16");
	});
});

describe("grip strength logging", () => {
	it("requires POST and bearer authentication", async () => {
		const wrongMethod = await dispatch(gripStrengthRequest(null, {}, "GET"));
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("POST");

		const unauthorized = await dispatch(
			gripStrengthRequest(undefined, { authorization: "Bearer wrong" }),
		);
		expect(unauthorized.status).toBe(401);
	});

	it("requires a small valid JSON request", async () => {
		const wrongType = await dispatch(
			gripStrengthRequest(undefined, { "content-type": "text/plain" }),
		);
		expect(wrongType.status).toBe(415);

		const malformed = await dispatch(
			new IncomingRequest(GRIP_STRENGTH_ENDPOINT, {
				method: "POST",
				headers: {
					authorization: `Bearer ${TOKEN}`,
					"content-type": "application/json",
				},
				body: "{",
			}),
		);
		expect(malformed.status).toBe(400);
		expect(await malformed.json()).toEqual({ error: "Invalid JSON" });

		const oversized = await dispatch(
			gripStrengthRequest(undefined, { "content-length": String(8 * 1024 + 1) }),
		);
		expect(oversized.status).toBe(413);
	});

	it.each([
		[
			{
				grip_strength_right: 44.1,
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"grip_strength_left",
		],
		[
			{
				grip_strength_left: 42.7,
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"grip_strength_right",
		],
		[
			{
				grip_strength_left: -1,
				grip_strength_right: 44.1,
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"grip_strength_left",
		],
		[
			{
				grip_strength_left: "42 kg",
				grip_strength_right: "44.1",
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"grip_strength_left",
		],
		[
			{
				grip_strength_left: "42.7",
				grip_strength_right: "1e2",
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"grip_strength_right",
		],
		[
			{
				grip_strength_left: 42.7,
				grip_strength_right: 44.1,
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kgf",
			},
			"unit",
		],
		[
			{
				grip_strength_left: 42.7,
				grip_strength_right: 44.1,
				idempotency_key: "key",
				observed_at: "2026-08-17T09:30:00",
				unit: "kg",
			},
			"observed_at",
		],
		[
			{
				grip_strength_left: 42.7,
				grip_strength_right: 44.1,
				idempotency_key: "",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			},
			"idempotency_key",
		],
	])("rejects an invalid payload field: %s", async (body, field) => {
		const response = await dispatch(gripStrengthRequest(body));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: `Invalid ${field}` });
	});

	it("stores a bilateral decimal measurement and its local time context", async () => {
		const response = await dispatch(gripStrengthRequest());
		const result = await response.json<{ measurement_event_id: string; status: string }>();

		expect(response.status).toBe(201);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(result.status).toBe("created");
		expect(result.measurement_event_id).toMatch(/^[0-9a-f-]{36}$/);

		const row = await env.HEALTH_DB.prepare(
			`SELECT id, measurement_type, grip_strength_left, grip_strength_right, unit,
				observed_at_ms, local_date, utc_offset_minutes, idempotency_key
			FROM measurement_events`,
		).first();
		expect(row).toEqual({
			grip_strength_left: 42.7,
			grip_strength_right: 44.1,
			id: result.measurement_event_id,
			idempotency_key: "shortcut-grip-run-001",
			local_date: "2026-08-17",
			measurement_type: "grip_strength",
			observed_at_ms: Date.parse("2026-08-17T09:30:00+05:30"),
			unit: "kg",
			utc_offset_minutes: 330,
		});
	});

	it("accepts readings reported in pounds", async () => {
		const response = await dispatch(
			gripStrengthRequest({
				grip_strength_left: 94.1,
				grip_strength_right: 97.2,
				idempotency_key: "shortcut-grip-run-lb",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "lb",
			}),
		);

		expect(response.status).toBe(201);
		expect(await env.HEALTH_DB.prepare("SELECT unit FROM measurement_events").first("unit")).toBe(
			"lb",
		);
	});

	it("returns the original event for an exact retry", async () => {
		const first = await dispatch(gripStrengthRequest());
		const second = await dispatch(gripStrengthRequest());
		const firstResult = await first.json<{ measurement_event_id: string }>();
		const secondResult = await second.json<{ measurement_event_id: string; status: string }>();

		expect(first.status).toBe(201);
		expect(second.status).toBe(200);
		expect(secondResult).toEqual({
			measurement_event_id: firstResult.measurement_event_id,
			status: "duplicate",
		});
		expect(
			await env.HEALTH_DB.prepare("SELECT COUNT(*) AS count FROM measurement_events").first(
				"count",
			),
		).toBe(1);
	});

	it("rejects reuse of an idempotency key with changed readings", async () => {
		await dispatch(gripStrengthRequest());
		const response = await dispatch(
			gripStrengthRequest({
				grip_strength_left: "43.2",
				grip_strength_right: "44.1",
				idempotency_key: "shortcut-grip-run-001",
				observed_at: "2026-08-17T09:30:00+05:30",
				unit: "kg",
			}),
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: "Idempotency key conflict" });
	});

	it("does not expose measurement data in structured logs", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const response = await dispatch(gripStrengthRequest());
		expect(response.status).toBe(201);

		const output = JSON.stringify(log.mock.calls);
		expect(output).not.toContain("42.7");
		expect(output).not.toContain("44.1");
		expect(output).not.toContain("shortcut-grip-run-001");
		expect(output).not.toContain("2026-08-17");
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
		expect(result.raw_key).toMatch(/^[^/]+-metrics-daily-session-001-[0-9a-f-]{36}\.json$/);

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
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const response = await dispatch(request(payload));
		expect(response.status).toBe(200);
		expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "health_ingest.archived" }));

		const output = JSON.stringify([...log.mock.calls, ...error.mock.calls, ...warn.mock.calls]);
		expect(output).not.toContain("PRIVATE-METRIC");
		expect(output).not.toContain("PRIVATE-GPS");
		expect(output).not.toContain(TOKEN);
	});
});
