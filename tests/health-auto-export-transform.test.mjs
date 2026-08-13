import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { HEALTH_EXPORT_MANIFEST } from "../scripts/health/health-export-manifest.mjs";
import { METRIC_DEFINITIONS } from "../scripts/health/metric-definitions.mjs";
import {
	HealthTransformError,
	normalizeHealthAutoExport,
} from "../scripts/health/normalize-health-auto-export.mjs";

const fixtures = path.resolve("tests/fixtures/health-auto-export");

async function fixture(name) {
	return JSON.parse(await fs.readFile(path.join(fixtures, name), "utf8"));
}

test("the reviewed metric allowlist contains 33 unique non-sleep definitions", () => {
	assert.equal(METRIC_DEFINITIONS.length, 33);
	assert.equal(new Set(METRIC_DEFINITIONS.map(({ code }) => code)).size, 33);
	assert.ok(METRIC_DEFINITIONS.every(({ code }) => code !== "sleep_analysis"));
});

test("the explicit corpus manifest is complete and excludes the extra full-January export", () => {
	assert.equal(HEALTH_EXPORT_MANIFEST.length, 13);
	assert.equal(
		HEALTH_EXPORT_MANIFEST.reduce((sum, { sizeBytes }) => sum + sizeBytes, 0),
		146_378_416,
	);
	assert.ok(
		HEALTH_EXPORT_MANIFEST.every(
			({ basename }) => basename !== "HealthAutoExport-2026-01-01-2026-01-31",
		),
	);
});

test("normalizes scalar rows and preserves offsets and missing sources", async () => {
	const result = normalizeHealthAutoExport(await fixture("scalar.json"));
	assert.equal(result.metricSamples.length, 2);
	assert.deepEqual(
		result.metricSamples.map(({ localDate, utcOffsetMinutes, sourceName }) => ({
			localDate,
			utcOffsetMinutes,
			sourceName,
		})),
		[
			{ localDate: "2026-01-01", utcOffsetMinutes: 330, sourceName: "Synthetic Watch" },
			{ localDate: "2026-01-01", utcOffsetMinutes: 330, sourceName: null },
		],
	);
	assert.equal(new Set(result.metricSamples.map(({ semanticKey }) => semanticKey)).size, 2);
});

test("normalizes heart-rate ranges", async () => {
	const { metricSamples } = normalizeHealthAutoExport(await fixture("range.json"));
	assert.deepEqual(
		{
			value: metricSamples[0].value,
			valueMin: metricSamples[0].valueMin,
			valueMax: metricSamples[0].valueMax,
			utcOffsetMinutes: metricSamples[0].utcOffsetMinutes,
		},
		{ value: 71.5, valueMin: 65, valueMax: 80, utcOffsetMinutes: -240 },
	);
});

test("maps absent optional sleep fields to null", async () => {
	const { sleepSummaries } = normalizeHealthAutoExport(await fixture("sleep.json"));
	assert.equal(sleepSummaries.length, 2);
	assert.equal(sleepSummaries[0].deepHours, 1.2);
	assert.equal(sleepSummaries[1].sleepStartMs, null);
	assert.equal(sleepSummaries[1].awakeHours, null);
	assert.equal(sleepSummaries[1].sourceName, null);
	assert.equal(sleepSummaries[1].totalSleepHours, 6.5);
});

test("maps wrist-temperature evening samples to the following wake date", async () => {
	const { metricSamples } = normalizeHealthAutoExport(await fixture("temperature-boundary.json"));
	assert.deepEqual(
		metricSamples.map(({ localDate }) => localDate),
		["2026-02-01", "2026-02-01"],
	);
	assert.equal(metricSamples[0].observedAtMs, Date.parse("2026-01-31T23:00:00+05:30"));
});

test("rejects normalized wrist-temperature daily conflicts", async () => {
	const payload = await fixture("temperature-boundary.json");
	payload.data.metrics[0].data[1].source = "Synthetic Watch";
	await assert.rejects(
		async () => normalizeHealthAutoExport(payload),
		(error) => error instanceof HealthTransformError && error.code === "temperature_daily_conflict",
	);
});

test("allows exact repeated facts as idempotent no-ops", async () => {
	const payload = await fixture("scalar.json");
	payload.data.metrics[0].data.push({ ...payload.data.metrics[0].data[0] });
	const result = normalizeHealthAutoExport(payload);
	assert.equal(result.inputRows, 3);
	assert.equal(result.metricSamples.length, 2);
	assert.equal(result.exactDuplicates, 1);
});

test("fails closed on unknown metrics, unit drift, row-shape drift, and invalid envelopes", () => {
	const cases = [
		[{ data: { metrics: [{ name: "unknown", units: "count", data: [] }] } }, "unknown_metric"],
		[{ data: { metrics: [{ name: "step_count", units: "steps", data: [] }] } }, "unit_drift"],
		[
			{
				data: {
					metrics: [
						{
							name: "heart_rate",
							units: "count/min",
							data: [{ date: "2026-01-01 10:00:00 +0530", qty: 70 }],
						},
					],
				},
			},
			"row_shape_drift",
		],
		[{}, "invalid_envelope"],
	];

	for (const [payload, code] of cases) {
		assert.throws(
			() => normalizeHealthAutoExport(payload),
			(error) => error instanceof HealthTransformError && error.code === code,
		);
	}
});

test("rejects invalid timestamps and non-finite numeric values", () => {
	for (const row of [
		{ date: "not-a-date", qty: 1 },
		{ date: "2026-01-01 10:00:00 +0530", qty: "NaN" },
	]) {
		assert.throws(() =>
			normalizeHealthAutoExport({
				data: { metrics: [{ name: "step_count", units: "count", data: [row] }] },
			}),
		);
	}
});
