import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapLocalD1 } from "../scripts/health/bootstrap-local-d1.mjs";
import { runD1 } from "../scripts/health/d1-runner.mjs";
import {
	METRIC_AGGREGATION_VERSION,
	METRIC_DEFINITIONS,
} from "../scripts/health/metric-definitions.mjs";
import {
	buildRangeRollupSql,
	deriveTouchedBuckets,
	mondayStart,
	monthStart,
} from "../scripts/health/metric-rollups.mjs";
import { parseRollupArguments } from "../scripts/health/refresh-health-rollups.mjs";
import { HEALTH_QUERY } from "../src/dev/health/healthDevIntegration.mjs";

async function withTemporaryD1(run) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "health-rollups-test-"));
	try {
		return await run(directory);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}

test("version 1 defines one reviewed operator per metric and excludes sound levels", () => {
	assert.equal(METRIC_AGGREGATION_VERSION, 1);
	assert.equal(METRIC_DEFINITIONS.length, 34);
	assert.ok(
		METRIC_DEFINITIONS.every(({ rollupMethod }) =>
			["sum", "average", "latest", "range", "none"].includes(rollupMethod),
		),
	);
	for (const code of ["environmental_audio_exposure", "headphone_audio_exposure"]) {
		assert.equal(
			METRIC_DEFINITIONS.find((definition) => definition.code === code)?.rollupMethod,
			"none",
		);
	}
});

test("derives unique supported touched buckets and calendar boundaries", () => {
	assert.deepEqual(
		deriveTouchedBuckets([
			{ metricCode: "step_count", localDate: "2025-12-31" },
			{ metricCode: "step_count", localDate: "2025-12-31" },
			{ metricCode: "heart_rate", localDate: "2026-01-01" },
			{ metricCode: "environmental_audio_exposure", localDate: "2026-01-01" },
		]),
		[
			{ metricCode: "heart_rate", localDate: "2026-01-01" },
			{ metricCode: "step_count", localDate: "2025-12-31" },
		],
	);
	assert.equal(mondayStart("2025-12-31"), "2025-12-29");
	assert.equal(mondayStart("2026-01-04"), "2025-12-29");
	assert.equal(mondayStart("2026-01-05"), "2026-01-05");
	assert.equal(monthStart("2026-01-31"), "2026-01-01");
});

test("projects composable day, week, and month state without manufacturing gaps", async () => {
	await withTemporaryD1(async (persistTo) => {
		const { target } = await bootstrapLocalD1({ persistTo });
		await runD1({
			target,
			command: `
INSERT INTO raw_deliveries (object_key, payload_sha256, received_at_ms, observed_start_ms, observed_end_ms, transform_status)
VALUES ('synthetic', '${"a".repeat(64)}', 1, 1, 6, 'complete');
INSERT INTO metric_samples (delivery_id, metric_id, observed_at_ms, local_date, utc_offset_minutes, value, value_min, value_max, source_name, semantic_key) VALUES
  (1, (SELECT id FROM metric_definitions WHERE code = 'step_count'), 1, '2025-12-31', 330, 10, NULL, NULL, NULL, '${"1".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'step_count'), 2, '2025-12-31', 330, 20, NULL, NULL, NULL, '${"2".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'step_count'), 3, '2026-01-02', 330, 40, NULL, NULL, NULL, '${"3".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'heart_rate'), 4, '2025-12-31', 330, 60, 55, 65, NULL, '${"4".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'heart_rate'), 5, '2025-12-31', 330, 90, 85, 95, NULL, '${"5".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'vo2_max'), 6, '2026-01-02', 330, 40, NULL, NULL, NULL, '${"6".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'vo2_max'), 6, '2026-01-02', 330, 41, NULL, NULL, NULL, '${"7".repeat(64)}'),
  (1, (SELECT id FROM metric_definitions WHERE code = 'environmental_audio_exposure'), 6, '2026-01-02', 330, 80, NULL, NULL, NULL, '${"8".repeat(64)}');`,
		});

		const statements = buildRangeRollupSql({ start: "2025-12-31", end: "2026-01-02" });
		await runD1({ target, command: statements.join("\n") });
		const payload = await runD1({
			target,
			json: true,
			command: `SELECT md.code, mr.grain, mr.period_start, mr.sample_count, mr.value_sum, mr.value_min, mr.value_max, mr.latest_value, mr.latest_observed_at_ms, mr.latest_sample_id
FROM metric_rollups mr JOIN metric_definitions md ON md.id = mr.metric_id
ORDER BY md.code, mr.grain, mr.period_start;
SELECT COUNT(*) AS count FROM metric_rollups mr JOIN metric_definitions md ON md.id = mr.metric_id WHERE md.code = 'environmental_audio_exposure';`,
		});
		const rollups = payload[0].results;
		assert.equal(payload[1].results[0].count, 0);
		assert.equal(
			rollups.some((row) => row.period_start === "2026-01-01" && row.grain === "day"),
			false,
		);

		const stepWeek = rollups.find(
			(row) =>
				row.code === "step_count" && row.grain === "week" && row.period_start === "2025-12-29",
		);
		assert.deepEqual(
			{
				count: stepWeek.sample_count,
				sum: stepWeek.value_sum,
				average: stepWeek.value_sum / stepWeek.sample_count,
			},
			{ count: 3, sum: 70, average: 70 / 3 },
		);

		const heartDay = rollups.find((row) => row.code === "heart_rate" && row.grain === "day");
		assert.deepEqual(
			{
				count: heartDay.sample_count,
				sum: heartDay.value_sum,
				min: heartDay.value_min,
				max: heartDay.value_max,
			},
			{ count: 2, sum: 150, min: 55, max: 95 },
		);

		const vo2Day = rollups.find((row) => row.code === "vo2_max" && row.grain === "day");
		assert.equal(vo2Day.latest_value, 41);
		assert.equal(vo2Day.latest_sample_id > 0, true);

		const queryStatements = HEALTH_QUERY.split(";")
			.map((statement) => statement.trim())
			.filter(Boolean);
		await runD1({
			target,
			command:
				"UPDATE metric_rollup_state SET first_local_date = '2025-12-31', last_local_date = '2026-01-02' WHERE singleton = 1;",
		});
		const incompleteBoundary = await runD1({
			target,
			json: true,
			command: `${queryStatements[0]};`,
		});
		assert.deepEqual(incompleteBoundary[0].results, []);
		for (const index of [0, 1, 3, 5]) {
			const plan = await runD1({
				target,
				json: true,
				command: `EXPLAIN QUERY PLAN ${queryStatements[index]};`,
			});
			const details = plan[0].results.map(({ detail }) => detail).join("\n");
			assert.match(details, /SEARCH (mr|metric_rollups) USING PRIMARY KEY/);
			assert.doesNotMatch(details, /metric_samples/);
		}
	});
});

test("range projector validates bounds and the versioned allowlist", () => {
	assert.throws(
		() =>
			buildRangeRollupSql({
				metricCodes: ["environmental_audio_exposure"],
				start: "2026-01-01",
				end: "2026-01-02",
			}),
		/rollup_invalid_metric/,
	);
	assert.throws(
		() => buildRangeRollupSql({ start: "2026-01-02", end: "2026-01-01" }),
		/rollup_invalid_range/,
	);
	assert.throws(
		() => buildRangeRollupSql({ start: "2026-02-30", end: "2026-03-01" }),
		/rollup_invalid_date/,
	);
});

test("operator commands are local-only and require explicit bounded repair input", () => {
	assert.deepEqual(parseRollupArguments(["--backfill"]), { mode: "backfill" });
	assert.deepEqual(
		parseRollupArguments([
			"--refresh",
			"--metric",
			"step_count",
			"--start",
			"2026-01-01",
			"--end",
			"2026-01-31",
		]),
		{
			mode: "refresh",
			metric: "step_count",
			start: "2026-01-01",
			end: "2026-01-31",
		},
	);
	for (const arguments_ of [
		["--refresh"],
		["--remote", "--start", "2026-01-01", "--end", "2026-01-02"],
		[
			"--refresh",
			"--metric",
			"headphone_audio_exposure",
			"--start",
			"2026-01-01",
			"--end",
			"2026-01-02",
		],
	]) {
		assert.throws(() => parseRollupArguments(arguments_));
	}
});
