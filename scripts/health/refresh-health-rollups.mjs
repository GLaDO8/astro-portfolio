import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveD1Target, runD1 } from "./d1-runner.mjs";
import { METRIC_AGGREGATION_VERSION, METRIC_DEFINITIONS_BY_CODE } from "./metric-definitions.mjs";
import { buildRangeRollupSql, buildTouchedRollupReconciliationSql } from "./metric-rollups.mjs";

function row(payload, resultIndex = 0, rowIndex = 0) {
	const value = payload?.[resultIndex]?.results?.[rowIndex];
	if (!value) throw new Error("rollup_invalid_database_response");
	return value;
}

function parseDate(value) {
	const date = new Date(`${value}T00:00:00Z`);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== value
	) {
		throw new Error("rollup_invalid_date");
	}
	return value;
}

export function parseRollupArguments(argv) {
	let mode;
	let metric;
	let start;
	let end;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if ((argument === "--backfill" || argument === "--refresh") && mode === undefined) {
			mode = argument.slice(2);
			continue;
		}
		if (
			["--metric", "--start", "--end"].includes(argument) &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		) {
			const value = argv[++index];
			if (argument === "--metric" && metric === undefined) metric = value;
			else if (argument === "--start" && start === undefined) start = value;
			else if (argument === "--end" && end === undefined) end = value;
			else throw new Error("rollup_invalid_arguments");
			continue;
		}
		throw new Error("rollup_invalid_arguments");
	}
	if (mode === "backfill") {
		if (metric || start || end) throw new Error("rollup_invalid_arguments");
		return { mode };
	}
	if (mode !== "refresh" || !start || !end) throw new Error("rollup_invalid_arguments");
	parseDate(start);
	parseDate(end);
	if (start > end) throw new Error("rollup_invalid_range");
	if (metric) {
		const definition = METRIC_DEFINITIONS_BY_CODE.get(metric);
		if (!definition || definition.rollupMethod === "none") throw new Error("rollup_invalid_metric");
	}
	return { mode, metric, start, end };
}

async function assertRollupSchema(target, run) {
	const payload = await run({
		target,
		json: true,
		command:
			"SELECT aggregation_version, status FROM metric_rollup_state WHERE singleton = 1; SELECT COUNT(*) AS count FROM d1_migrations WHERE name = '0003_metric_rollups.sql';",
	});
	const state = row(payload);
	if (
		Number(state.aggregation_version) !== METRIC_AGGREGATION_VERSION ||
		Number(row(payload, 1).count) !== 1
	) {
		throw new Error("rollup_migration_required");
	}
	return state;
}

async function executeSql(target, statements, run) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "health-rollups-"));
	await fs.chmod(directory, 0o700);
	const file = path.join(directory, "refresh.sql");
	try {
		await fs.writeFile(file, `${statements.join("\n")}\n`, { mode: 0o600 });
		await run({ target, file });
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}

function monthChunks(firstDate, lastDate) {
	const chunks = [];
	let cursor = `${firstDate.slice(0, 7)}-01`;
	while (cursor <= lastDate) {
		const next = new Date(`${cursor}T00:00:00Z`);
		next.setUTCMonth(next.getUTCMonth() + 1);
		const nextMonth = next.toISOString().slice(0, 10);
		const monthEnd = new Date(next.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		chunks.push({
			start: cursor < firstDate ? firstDate : cursor,
			end: monthEnd > lastDate ? lastDate : monthEnd,
		});
		cursor = nextMonth;
	}
	return chunks;
}

const canonicalDailyCte = `WITH canonical AS (
  SELECT md.id AS metric_id, ms.local_date AS period_start,
    COUNT(*) AS sample_count, SUM(ms.value) AS value_sum,
    MIN(COALESCE(ms.value_min, ms.value)) AS value_min,
    MAX(COALESCE(ms.value_max, ms.value)) AS value_max,
    (SELECT latest.value FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_value,
    (SELECT latest.observed_at_ms FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_observed_at_ms,
    (SELECT latest.id FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_sample_id
  FROM metric_samples ms JOIN metric_definitions md ON md.id = ms.metric_id
  WHERE md.rollup_method <> 'none'
  GROUP BY md.id, ms.local_date
)`;

function canonicalHigherCte(grain) {
	const periodStart =
		grain === "week"
			? "date(period_start, '-' || ((CAST(strftime('%w', period_start) AS INTEGER) + 6) % 7) || ' days')"
			: "date(period_start, 'start of month')";
	return `WITH children AS (
  SELECT metric_id, ${periodStart} AS period_start, sample_count, value_sum, value_min, value_max,
    latest_value, latest_observed_at_ms, latest_sample_id,
    ROW_NUMBER() OVER (PARTITION BY metric_id, ${periodStart} ORDER BY latest_observed_at_ms DESC, latest_sample_id DESC) AS recency
  FROM metric_rollups WHERE grain = 'day'
), canonical AS (
  SELECT metric_id, period_start, SUM(sample_count) AS sample_count, SUM(value_sum) AS value_sum,
    MIN(value_min) AS value_min, MAX(value_max) AS value_max,
    MAX(CASE WHEN recency = 1 THEN latest_value END) AS latest_value,
    MAX(CASE WHEN recency = 1 THEN latest_observed_at_ms END) AS latest_observed_at_ms,
    MAX(CASE WHEN recency = 1 THEN latest_sample_id END) AS latest_sample_id
  FROM children GROUP BY metric_id, period_start
)`;
}

function reconciliationDifferenceSql(cte, grain, reverse = false) {
	const canonical =
		"SELECT metric_id, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id FROM canonical";
	const actual = `SELECT metric_id, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id FROM metric_rollups WHERE grain = '${grain}'`;
	return `${cte}\nSELECT COUNT(*) AS count FROM (${reverse ? actual : canonical} EXCEPT ${reverse ? canonical : actual});`;
}

async function reconcile(target, run) {
	const payload = await run({
		target,
		json: true,
		command: `${reconciliationDifferenceSql(canonicalDailyCte, "day")}
${reconciliationDifferenceSql(canonicalDailyCte, "day", true)}
${reconciliationDifferenceSql(canonicalHigherCte("week"), "week")}
${reconciliationDifferenceSql(canonicalHigherCte("week"), "week", true)}
${reconciliationDifferenceSql(canonicalHigherCte("month"), "month")}
${reconciliationDifferenceSql(canonicalHigherCte("month"), "month", true)}
SELECT COUNT(*) AS count FROM metric_rollups WHERE aggregation_version <> ${METRIC_AGGREGATION_VERSION};
PRAGMA foreign_key_check;`,
	});
	if (
		payload.slice(0, 7).some((result) => Number(result?.results?.[0]?.count) !== 0) ||
		payload?.[7]?.results?.length !== 0
	) {
		throw new Error("rollup_reconciliation_failed");
	}
}

async function coverage(target, run) {
	const payload = await run({
		target,
		json: true,
		command:
			"SELECT MIN(local_date) AS first_local_date, MAX(local_date) AS last_local_date FROM metric_samples; SELECT MAX(id) AS last_complete_delivery_id FROM raw_deliveries WHERE transform_status = 'complete';",
	});
	return { ...row(payload), ...row(payload, 1) };
}

function selectedRangeSamples(metric, start, end) {
	const codes = metric
		? [metric]
		: [...METRIC_DEFINITIONS_BY_CODE.values()]
				.filter(({ rollupMethod }) => rollupMethod !== "none")
				.map(({ code }) => code);
	const samples = [];
	let cursor = new Date(`${start}T00:00:00Z`);
	const last = new Date(`${end}T00:00:00Z`);
	while (cursor <= last) {
		const localDate = cursor.toISOString().slice(0, 10);
		for (const metricCode of codes) samples.push({ metricCode, localDate });
		cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
	}
	return samples;
}

async function reconcileRange({ metric, start, end, target, run }) {
	await executeSql(
		target,
		[
			"CREATE TABLE local_reconciliation_assertion (value INTEGER NOT NULL CHECK (value = 0)) STRICT;",
			...buildTouchedRollupReconciliationSql(selectedRangeSamples(metric, start, end)),
			"DROP TABLE local_reconciliation_assertion;",
		],
		run,
	);
}

export async function backfillRollups({ target = resolveD1Target(), run = runD1 } = {}) {
	if (target.mode !== "local") throw new Error("rollup_local_only");
	await assertRollupSchema(target, run);
	const before = await run({
		target,
		json: true,
		command:
			"SELECT COUNT(*) AS raw_count FROM metric_samples; SELECT COUNT(*) AS sleep_count FROM sleep_summaries; SELECT COUNT(*) AS delivery_count FROM raw_deliveries;",
	});
	await executeSql(
		target,
		[
			"UPDATE metric_rollup_state SET status = 'building', refreshed_at_ms = unixepoch('subsec') * 1000 WHERE singleton = 1;",
			"DELETE FROM metric_rollups;",
		],
		run,
	);
	const dates = await coverage(target, run);
	if (dates.first_local_date !== null) {
		for (const chunk of monthChunks(dates.first_local_date, dates.last_local_date)) {
			await executeSql(
				target,
				buildRangeRollupSql({ ...chunk, deleteEmpty: false, includeHigher: false }),
				run,
			);
		}
		await executeSql(
			target,
			buildRangeRollupSql({
				start: dates.first_local_date,
				end: dates.last_local_date,
				deleteEmpty: false,
				includeDaily: false,
			}),
			run,
		);
	}
	await reconcile(target, run);
	await executeSql(
		target,
		[
			`UPDATE metric_rollup_state SET status = 'ready', first_local_date = ${dates.first_local_date === null ? "NULL" : `'${dates.first_local_date}'`}, last_local_date = ${dates.last_local_date === null ? "NULL" : `'${dates.last_local_date}'`}, last_complete_delivery_id = ${dates.last_complete_delivery_id === null ? "NULL" : Number(dates.last_complete_delivery_id)}, refreshed_at_ms = unixepoch('subsec') * 1000 WHERE singleton = 1 AND aggregation_version = ${METRIC_AGGREGATION_VERSION};`,
		],
		run,
	);
	const after = await run({
		target,
		json: true,
		command:
			"SELECT COUNT(*) AS raw_count FROM metric_samples; SELECT COUNT(*) AS sleep_count FROM sleep_summaries; SELECT COUNT(*) AS delivery_count FROM raw_deliveries; SELECT grain, COUNT(*) AS count FROM metric_rollups GROUP BY grain ORDER BY grain;",
	});
	for (let index = 0; index < 3; index += 1) {
		const key = Object.keys(row(before, index))[0];
		if (Number(row(before, index)[key]) !== Number(row(after, index)[key])) {
			throw new Error("rollup_canonical_count_changed");
		}
	}
	return {
		version: METRIC_AGGREGATION_VERSION,
		range: dates.first_local_date === null ? null : [dates.first_local_date, dates.last_local_date],
		buckets: Object.fromEntries(after[3].results.map(({ grain, count }) => [grain, Number(count)])),
	};
}

export async function refreshRollups({
	metric,
	start,
	end,
	target = resolveD1Target(),
	run = runD1,
}) {
	if (target.mode !== "local") throw new Error("rollup_local_only");
	const state = await assertRollupSchema(target, run);
	if (state.status !== "ready") throw new Error("rollup_backfill_required");
	await executeSql(
		target,
		[
			...buildRangeRollupSql({ metricCodes: metric ? [metric] : undefined, start, end }),
			"UPDATE metric_rollup_state SET refreshed_at_ms = unixepoch('subsec') * 1000 WHERE singleton = 1;",
		],
		run,
	);
	await reconcileRange({ metric, start, end, target, run });
	const payload = await run({
		target,
		json: true,
		command: `SELECT grain, COUNT(*) AS count FROM metric_rollups WHERE period_start BETWEEN '${start}' AND '${end}'${metric ? ` AND metric_id = (SELECT id FROM metric_definitions WHERE code = '${metric}')` : ""} GROUP BY grain ORDER BY grain;`,
	});
	return {
		version: METRIC_AGGREGATION_VERSION,
		range: [start, end],
		metric: metric ?? null,
		buckets: Object.fromEntries(
			payload[0].results.map(({ grain, count }) => [grain, Number(count)]),
		),
	};
}

export async function main(argv = process.argv.slice(2)) {
	const startedAt = performance.now();
	try {
		const options = parseRollupArguments(argv);
		const report =
			options.mode === "backfill" ? await backfillRollups({}) : await refreshRollups(options);
		console.log(
			JSON.stringify({
				status: "ready",
				...report,
				reconciled: true,
				durationMs: Math.round(performance.now() - startedAt),
			}),
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: error instanceof Error ? error.message : "rollup_refresh_failed",
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
