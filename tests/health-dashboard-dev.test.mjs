import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import astroConfig from "../astro.config.mjs";
import {
	getAppleHealthDataRange,
	getLatestMedicalDate,
	rollUpWeeklyExerciseTime,
} from "../src/components/health/healthData.ts";
import { medicalDefinitions, medicalSections } from "../src/components/health/medicalMetrics.ts";
import {
	assertReadOnlyHealthQuery,
	HEALTH_QUERY,
	healthDataPlugin,
	healthDevIntegration,
	normalizeHealthQueryOutput,
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
	];

	assert.deepEqual(normalizeHealthQueryOutput(payload), {
		activity: payload[0].results,
		recovery: payload[1].results,
		sleep: payload[2].results,
		vo2Max: payload[3].results,
		medical: payload[4].results,
		weight: payload[5].results,
	});
});

test("rejects incomplete D1 output", () => {
	assert.throws(() => normalizeHealthQueryOutput([{ results: [] }]), /six result sets/);
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
	assert.equal(
		resolveDashboardTarget({
			HEALTH_DASHBOARD_D1_TARGET: "remote",
			HEALTH_DASHBOARD_REMOTE_CONFIRM: "7f570a9a-fab7-4f17-a69a-c7717320802f",
		}).mode,
		"remote",
	);
});

function expectAbsolutePath(value) {
	assert.equal(path.isAbsolute(value), true);
	return value;
}

test("accepts only read-only dashboard SQL", () => {
	assert.doesNotThrow(() => assertReadOnlyHealthQuery(HEALTH_QUERY));
	for (const sql of [
		"DELETE FROM metric_samples;",
		"PRAGMA foreign_keys = OFF;",
		"WITH selected AS (SELECT 1) UPDATE medical_metrics SET value = 1;",
	]) {
		assert.throws(() => assertReadOnlyHealthQuery(sql), /health_query_not_read_only/);
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

test("remote dashboard caches success but does not retry a failed request", async () => {
	const env = {
		HEALTH_DASHBOARD_D1_TARGET: "remote",
		HEALTH_DASHBOARD_REMOTE_CONFIRM: "7f570a9a-fab7-4f17-a69a-c7717320802f",
	};
	let successCalls = 0;
	const successRequest = createMiddlewareHarness(
		healthDataPlugin({
			env,
			queryHealthData: async () => {
				successCalls += 1;
				return { activity: [], recovery: [], sleep: [], vo2Max: [], medical: [], weight: [] };
			},
			log: () => {},
		}),
	);
	await successRequest();
	await successRequest();
	assert.equal(successCalls, 1);

	let failureCalls = 0;
	const failureRequest = createMiddlewareHarness(
		healthDataPlugin({
			env,
			queryHealthData: async () => {
				failureCalls += 1;
				throw new Error("private detail");
			},
			log: () => {},
		}),
	);
	const failure = await failureRequest();
	assert.equal(failureCalls, 1);
	assert.equal(failure.statusCode, 500);
	assert.equal(failure.headers.get("Cache-Control"), "no-store");
	assert.deepEqual(JSON.parse(failure.body), {
		error: "health_database_unavailable",
		source: "remote",
	});
	assert.doesNotMatch(failure.body, /private detail/);
});

test("dashboard middleware rejects non-GET requests", async () => {
	const request = createMiddlewareHarness(
		healthDataPlugin({ env: {}, queryHealthData: async () => assert.fail(), log: () => {} }),
	);
	const response = await request("POST");
	assert.equal(response.statusCode, 405);
	assert.equal(response.headers.get("Allow"), "GET");
});

test("selects sparse body-mass observations chronologically", () => {
	assert.match(HEALTH_QUERY, /WHERE md\.code = 'weight_body_mass'/);
	assert.match(HEALTH_QUERY, /PARTITION BY ms\.local_date ORDER BY ms\.observed_at_ms DESC/);
	assert.match(HEALTH_QUERY, /WHERE recency = 1 ORDER BY local_date/);
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

test("rolls Apple Exercise Time into Monday-starting weeks", () => {
	assert.deepEqual(
		rollUpWeeklyExerciseTime([
			{ local_date: "2026-08-02", exercise_minutes: 15 },
			{ local_date: "2026-08-03", exercise_minutes: 20 },
			{ local_date: "2026-08-09", exercise_minutes: 30 },
			{ local_date: "2026-08-10", exercise_minutes: 40 },
		]),
		[
			{ date: "2026-07-27", value: 15 },
			{ date: "2026-08-03", value: 50 },
			{ date: "2026-08-10", value: 40 },
		],
	);
});

test("sums observed exercise days without inventing missing days or weeks", () => {
	assert.deepEqual(
		rollUpWeeklyExerciseTime([
			{ local_date: "2026-08-03", exercise_minutes: null },
			{ local_date: "2026-08-05", exercise_minutes: 25 },
			{ local_date: "2026-08-09", exercise_minutes: 35 },
			{ local_date: "2026-08-17", exercise_minutes: 10 },
		]),
		[
			{ date: "2026-08-03", value: 60 },
			{ date: "2026-08-17", value: 10 },
		],
	);
});

test("keeps an observed week with no exercise value empty", () => {
	assert.deepEqual(
		rollUpWeeklyExerciseTime([
			{ local_date: "2026-08-24", exercise_minutes: null },
			{ local_date: "2026-08-26", exercise_minutes: null },
		]),
		[{ date: "2026-08-24", value: null }],
	);
});

test("finds the Apple Health range without medical report dates or empty spine rows", () => {
	assert.deepEqual(
		getAppleHealthDataRange({
			activity: [
				{ local_date: "2025-12-30", steps: null, active_energy_kj: null, exercise_minutes: null },
				{ local_date: "2026-01-03", steps: 1234, active_energy_kj: null, exercise_minutes: null },
			],
			recovery: [],
			sleep: [{ local_date: "2026-01-02", total_sleep_hours: 7.5 }],
			vo2Max: [{ local_date: "2026-01-08", value: 42 }],
			medical: [{ collected_at_ms: Date.parse("2025-12-31T20:00:00Z"), value: 5.4 }],
			weight: [{ local_date: "2026-01-06", value: 70 }],
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
			activity: [
				{ local_date: "2026-01-01", steps: null, active_energy_kj: null, exercise_minutes: null },
			],
			recovery: [{ local_date: "2026-01-02", resting_heart_rate: null, hrv: null }],
			sleep: [],
			vo2Max: [],
			medical: [{ collected_at_ms: Date.parse("2026-01-03T10:00:00Z"), value: 5.4 }],
			weight: [],
		}),
		null,
	);
});
