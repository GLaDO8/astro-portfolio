import assert from "node:assert/strict";
import test from "node:test";

import astroConfig from "../astro.config.mjs";
import {
	getAppleHealthDataRange,
	getLatestMedicalDate,
	rollUpWeeklyExerciseTime,
} from "../src/components/health/healthData.ts";
import { medicalDefinitions, medicalSections } from "../src/components/health/medicalMetrics.ts";
import {
	HEALTH_QUERY,
	healthDevIntegration,
	normalizeHealthQueryOutput,
} from "../src/dev/health/healthDevIntegration.mjs";

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
