import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import astroConfig from "../astro.config.mjs";
import {
	getAppleHealthDataRange,
	getLatestMedicalDate,
} from "../src/components/health/healthData.ts";
import { medicalDefinitions, medicalSections } from "../src/components/health/medicalMetrics.ts";
import {
	assertReadOnlyHealthQuery,
	HEALTH_QUERY,
	HEALTH_STATE_QUERY,
	healthDataPlugin,
	healthDevIntegration,
	normalizeHealthQueryOutput,
	queryHealthData,
	resolveDashboardTarget,
} from "../src/dev/health/healthDevIntegration.mjs";

function createMiddlewareHarness(plugin) {
	let handler;
	plugin.configureServer({
		middlewares: {
			use(route, nextHandler) {
				assert.equal(route, "/__dev/health-data");
				handler = nextHandler;
			},
		},
	});

	return async function request(method = "GET") {
		const headers = new Map();
		let body = "";
		const response = {
			statusCode: 200,
			setHeader(name, value) {
				headers.set(name, value);
			},
			end(value = "") {
				body = value;
			},
		};
		await handler({ method }, response);
		return { statusCode: response.statusCode, headers, body };
	};
}

const requestedMedicalCodes = [
	"hba1c",
	"vitamin_d_25_oh",
	"cholesterol_total",
	"cholesterol_hdl",
	"cholesterol_ldl_calculated",
	"cholesterol_vldl_calculated",
	"cholesterol_non_hdl",
	"triglycerides",
	"rbc_count",
	"hemoglobin",
	"hematocrit",
	"mcv",
	"mch",
	"mchc",
	"rdw_cv",
	"wbc_count",
	"neutrophils_percent",
	"lymphocytes_percent",
	"monocytes_percent",
	"eosinophils_percent",
	"basophils_percent",
	"absolute_neutrophil_count",
	"absolute_lymphocyte_count",
	"absolute_monocyte_count",
	"absolute_eosinophil_count",
	"absolute_basophil_count",
	"platelet_count",
	"mean_platelet_volume",
	"alt",
	"ast",
	"alkaline_phosphatase",
	"ggt",
	"bilirubin_total",
	"bilirubin_direct",
	"bilirubin_indirect",
	"albumin",
	"globulin",
	"protein_total",
	"creatinine_serum",
	"egfr",
	"bun",
	"urea",
	"uric_acid",
	"sodium",
	"potassium",
	"chloride",
	"calcium",
	"phosphorus",
	"tsh",
	"t3_total",
	"t4_total",
	"iron_serum",
	"tibc",
	"uibc",
	"transferrin_saturation",
	"vitamin_b12",
];

test("ignores the 1Password-mounted env file in the Vite watcher", () => {
	assert.deepEqual(astroConfig.vite?.server?.watch?.ignored, ["**/.env"]);
});

test("registers the health page and endpoint only for astro dev", () => {
	const integration = healthDevIntegration();
	const hook = integration.hooks["astro:config:setup"];
	const devRoutes = [];

	hook({
		command: "dev",
		injectRoute: (route) => devRoutes.push(route),
	});

	assert.equal(devRoutes.length, 1);
	assert.equal(devRoutes[0].pattern, "/health");

	for (const command of ["build", "preview", "sync"]) {
		const routes = [];
		hook({
			command,
			injectRoute: (route) => routes.push(route),
		});
		assert.deepEqual(routes, []);
	}
});

test("normalizes the selected D1 result sets without Wrangler metadata", () => {
	const payload = [
		{ results: [{ local_date: "2026-01-01", steps: 1234, active_energy_kj: 456 }] },
		{ results: [{ local_date: "2026-01-01", resting_heart_rate: 60, hrv: 45 }] },
		{ results: [{ local_date: "2026-01-01", total_sleep_hours: 7.5 }] },
		{ results: [{ local_date: "2026-01-01", value: 41.2 }] },
		{
			results: [
				{
					metric_code: "hba1c",
					collected_at_ms: 1,
					value: 5.4,
					unit: "%",
					qualifier: null,
				},
			],
		},
		{ results: [{ local_date: "2026-01-09", value: 70.25 }] },
		{ results: [{ local_date: "2026-01-09", value: 18.5 }] },
		{ results: [{ code: "step_count", local_date: "2026-01-09", value: 1234 }] },
	];
	const state = {
		aggregation_version: 1,
		first_local_date: "2026-01-01",
		last_local_date: "2026-01-09",
		first_sleep_date: null,
		last_sleep_date: null,
	};

	assert.deepEqual(normalizeHealthQueryOutput(payload, state), {
		activity: payload[0].results,
		recovery: payload[1].results,
		sleep: payload[2].results,
		vo2Max: payload[3].results,
		medical: payload[4].results,
		weight: payload[5].results,
		bodyFat: payload[6].results,
		summaries: { step_count: { local_date: "2026-01-09", value: 1234 } },
		coverage: { firstDate: "2026-01-01", lastDate: "2026-01-09" },
		aggregation: {
			version: 1,
			grains: {
				activity: "week",
				recovery: "week",
				vo2Max: "day",
				weight: "day",
				bodyFat: "day",
				summaries: "day",
			},
		},
	});
});

test("rejects incomplete D1 output", () => {
	assert.throws(() => normalizeHealthQueryOutput([{ results: [] }], {}), /eight result sets/);
});

test("defaults the dashboard to local and guards exceptional remote reads", () => {
	assert.deepEqual(resolveDashboardTarget({}), {
		mode: "local",
		persistTo: expectAbsolutePath(resolveDashboardTarget({}).persistTo),
	});
	assert.throws(
		() => resolveDashboardTarget({ HEALTH_DASHBOARD_D1_TARGET: "remote" }),
		/dashboard_target_invalid/,
	);
	assert.throws(
		() =>
			resolveDashboardTarget({
				HEALTH_DASHBOARD_D1_TARGET: "remote",
				HEALTH_DASHBOARD_REMOTE_CONFIRM: "7f570a9a-fab7-4f17-a69a-c7717320802f",
			}),
		/dashboard_target_invalid/,
	);
});

function expectAbsolutePath(value) {
	assert.equal(path.isAbsolute(value), true);
	return value;
}

test("accepts only read-only dashboard SQL", () => {
	assert.doesNotThrow(() => assertReadOnlyHealthQuery(HEALTH_QUERY));
	assert.doesNotThrow(() => assertReadOnlyHealthQuery(HEALTH_STATE_QUERY));
	for (const sql of [
		"DELETE FROM metric_samples;",
		"PRAGMA foreign_keys = OFF;",
		"WITH selected AS (SELECT 1) UPDATE medical_metrics SET value = 1;",
	]) {
		assert.throws(() => assertReadOnlyHealthQuery(sql), /health_query_not_read_only/);
	}
});

test("rejects stale or version-mismatched rollup state without a raw fallback", async () => {
	for (const state of [
		{ aggregation_version: 1, status: "needs_backfill" },
		{ aggregation_version: 2, status: "ready" },
	]) {
		let calls = 0;
		await assert.rejects(
			() =>
				queryHealthData({ mode: "local" }, async ({ command }) => {
					calls += 1;
					assert.doesNotMatch(command, /metric_samples/);
					return [{ results: [state] }];
				}),
			/health_rollup_backfill_required/,
		);
		assert.equal(calls, 1);
	}
});

test("local dashboard GETs re-query and return no-store shaped JSON", async () => {
	let calls = 0;
	const query = async () => {
		calls += 1;
		return { activity: [], recovery: [], sleep: [], vo2Max: [], medical: [], weight: [] };
	};
	const request = createMiddlewareHarness(
		healthDataPlugin({
			env: {},
			queryHealthData: query,
			log: () => {},
		}),
	);

	const first = await request();
	const second = await request();
	assert.equal(calls, 2);
	assert.equal(first.statusCode, 200);
	assert.equal(first.headers.get("Cache-Control"), "no-store");
	assert.deepEqual(JSON.parse(first.body), await query());
	assert.equal(second.statusCode, 200);
});

test("returns an actionable local error when rollups need backfill", async () => {
	const failureRequest = createMiddlewareHarness(
		healthDataPlugin({
			env: {},
			queryHealthData: async () => {
				throw new Error("health_rollup_backfill_required");
			},
			log: () => {},
		}),
	);
	const failure = await failureRequest();
	assert.equal(failure.statusCode, 503);
	assert.equal(failure.headers.get("Cache-Control"), "no-store");
	assert.deepEqual(JSON.parse(failure.body), {
		error: "health_rollup_backfill_required",
		action: "pnpm health:rollups:backfill:local",
	});
});

test("dashboard middleware rejects non-GET requests", async () => {
	const request = createMiddlewareHarness(
		healthDataPlugin({ env: {}, queryHealthData: async () => assert.fail(), log: () => {} }),
	);
	const response = await request("POST");
	assert.equal(response.statusCode, 405);
	assert.equal(response.headers.get("Allow"), "GET");
});

test("selects rollups without raw metric scans or date spines", () => {
	assert.doesNotMatch(HEALTH_QUERY, /metric_samples|WITH RECURSIVE/i);
	assert.match(HEALTH_QUERY, /metric_rollups/g);
	assert.match(HEALTH_QUERY, /code = 'weight_body_mass'/);
	assert.match(HEALTH_QUERY, /code = 'body_fat_percentage'/);
	assert.match(HEALTH_QUERY, /mr\.grain = 'day'/);
	assert.match(HEALTH_QUERY, /mr\.grain = 'week'/);
	assert.match(HEALTH_QUERY, /date\(state\.last_local_date, '-6 days'\)/);
});

test("selects every requested first-batch medical metric", () => {
	const medicalQuery = HEALTH_QUERY.match(/SELECT metric_code[\s\S]+?;/)?.[0];
	assert.ok(medicalQuery, "Expected a medical_metrics query.");
	assert.match(medicalQuery, /value, unit, qualifier/);

	for (const code of requestedMedicalCodes) {
		assert.match(medicalQuery, new RegExp(`'${code}'`));
	}
});

test("renders every selected medical metric in exactly one dashboard group", () => {
	const sectionCodes = medicalSections.flatMap((section) =>
		section.groups.flatMap((group) => group.codes),
	);

	assert.equal(new Set(sectionCodes).size, sectionCodes.length);
	assert.deepEqual(sectionCodes.toSorted(), Object.keys(medicalDefinitions).toSorted());
	assert.deepEqual(sectionCodes.toSorted(), requestedMedicalCodes.toSorted());
});

test("uses ready rollup and sleep coverage without medical report dates", () => {
	assert.deepEqual(
		getAppleHealthDataRange({
			coverage: { firstDate: "2026-01-02", lastDate: "2026-01-08" },
		}),
		{ firstDate: "2026-01-02", lastDate: "2026-01-08" },
	);
});

test("finds the latest blood test date in India", () => {
	assert.equal(
		getLatestMedicalDate([
			{ collected_at_ms: Date.parse("2025-12-31T10:00:00Z"), value: 5.2 },
			{ collected_at_ms: Date.parse("2025-12-31T20:00:00Z"), value: 5.4 },
		]),
		"2026-01-01",
	);
});

test("returns no Apple Health range when every Apple Health value is missing", () => {
	assert.equal(
		getAppleHealthDataRange({
			coverage: { firstDate: null, lastDate: null },
		}),
		null,
	);
});
