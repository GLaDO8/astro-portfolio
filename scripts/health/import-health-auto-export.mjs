import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PRODUCTION_DATABASE_ID, resolveD1Target, runD1 } from "./d1-runner.mjs";
import { HEALTH_EXPORT_MANIFEST_BY_HASH } from "./health-export-manifest.mjs";
import { buildTouchedRollupReconciliationSql, buildTouchedRollupSql } from "./metric-rollups.mjs";
import { normalizeHealthAutoExport } from "./normalize-health-auto-export.mjs";

function usage(message) {
	if (message) console.error(message);
	console.error(
		"Usage: node scripts/health/import-health-auto-export.mjs [--local|--remote --database-id ID] [--persist-to DIR] <exact-json-path>...",
	);
	process.exitCode = 2;
}

export function parseArguments(argv) {
	let mode = "dry-run";
	let databaseId = null;
	let persistTo = null;
	let selectedMode = false;
	const files = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (argument === "--local" || argument === "--remote") {
			if (selectedMode) return null;
			selectedMode = true;
			mode = argument.slice(2);
		} else if (
			argument === "--database-id" &&
			databaseId === null &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		)
			databaseId = argv[++index];
		else if (
			argument === "--persist-to" &&
			persistTo === null &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		)
			persistTo = argv[++index];
		else if (argument.startsWith("-")) return null;
		else files.push(argument);
	}
	if (files.length === 0) return null;
	if (mode === "remote" && databaseId !== PRODUCTION_DATABASE_ID) return null;
	if (mode !== "remote" && databaseId) return null;
	if (mode !== "local" && persistTo) return null;
	return { mode, databaseId, persistTo, files };
}

function sqlText(value) {
	if (value === null) return "NULL";
	return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
	return value === null ? "NULL" : String(value);
}

function batches(values, size = 100) {
	const output = [];
	for (let index = 0; index < values.length; index += size)
		output.push(values.slice(index, index + size));
	return output;
}

export function buildSql({
	objectKey,
	payloadSha256,
	receivedAtMs,
	normalized,
	includeRollups = true,
}) {
	const sql = [
		"PRAGMA foreign_keys = ON;",
		`INSERT INTO raw_deliveries (object_key, payload_sha256, received_at_ms, observed_start_ms, observed_end_ms, transform_status) VALUES (${sqlText(objectKey)}, ${sqlText(payloadSha256)}, ${receivedAtMs}, ${normalized.observedStartMs}, ${normalized.observedEndMs}, 'pending') ON CONFLICT(payload_sha256) DO NOTHING;`,
	];

	for (const batch of batches(normalized.metricSamples)) {
		const rows = batch
			.map(
				(sample) =>
					`(${sqlText(sample.metricCode)}, ${sqlText(sample.unit)}, ${sample.observedAtMs}, ${sqlText(sample.localDate)}, ${sample.utcOffsetMinutes}, ${sample.value}, ${sqlNumber(sample.valueMin)}, ${sqlNumber(sample.valueMax)}, ${sqlText(sample.sourceName)}, ${sqlText(sample.semanticKey)})`,
			)
			.join(",\n");
		sql.push(
			`WITH rows(metric_code, unit, observed_at_ms, local_date, utc_offset_minutes, value, value_min, value_max, source_name, semantic_key) AS (VALUES\n${rows}\n), delivery AS (SELECT id FROM raw_deliveries WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'pending') INSERT INTO metric_samples (delivery_id, metric_id, observed_at_ms, local_date, utc_offset_minutes, value, value_min, value_max, source_name, semantic_key) SELECT delivery.id, (SELECT id FROM metric_definitions WHERE code = rows.metric_code AND unit = rows.unit), rows.observed_at_ms, rows.local_date, rows.utc_offset_minutes, rows.value, rows.value_min, rows.value_max, rows.source_name, rows.semantic_key FROM rows CROSS JOIN delivery WHERE true ON CONFLICT(semantic_key) DO NOTHING;`,
		);
	}

	for (const batch of batches(normalized.sleepSummaries)) {
		const rows = batch
			.map(
				(sleep) =>
					`(${sqlText(sleep.localDate)}, ${sqlNumber(sleep.sleepStartMs)}, ${sqlNumber(sleep.sleepEndMs)}, ${sqlNumber(sleep.totalSleepHours)}, ${sqlNumber(sleep.awakeHours)}, ${sqlNumber(sleep.coreHours)}, ${sqlNumber(sleep.deepHours)}, ${sqlNumber(sleep.remHours)}, ${sqlText(sleep.sourceName)}, ${sqlText(sleep.semanticKey)})`,
			)
			.join(",\n");
		sql.push(
			`WITH rows(local_date, sleep_start_ms, sleep_end_ms, total_sleep_hours, awake_hours, core_hours, deep_hours, rem_hours, source_name, semantic_key) AS (VALUES\n${rows}\n), delivery AS (SELECT id FROM raw_deliveries WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'pending') INSERT INTO sleep_summaries (delivery_id, local_date, sleep_start_ms, sleep_end_ms, total_sleep_hours, awake_hours, core_hours, deep_hours, rem_hours, source_name, semantic_key) SELECT delivery.id, rows.local_date, rows.sleep_start_ms, rows.sleep_end_ms, rows.total_sleep_hours, rows.awake_hours, rows.core_hours, rows.deep_hours, rows.rem_hours, rows.source_name, rows.semantic_key FROM rows CROSS JOIN delivery WHERE true ON CONFLICT(semantic_key) DO NOTHING;`,
		);
	}

	if (includeRollups) {
		sql.push(...buildTouchedRollupSql({ metricSamples: normalized.metricSamples, payloadSha256 }));
		sql.push(
			`WITH delivery AS (SELECT id FROM raw_deliveries WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'pending') UPDATE metric_rollup_state SET data_revision = data_revision + 1, last_complete_delivery_id = (SELECT id FROM delivery), first_local_date = (SELECT MIN(local_date) FROM metric_samples), last_local_date = (SELECT MAX(local_date) FROM metric_samples), refreshed_at_ms = unixepoch('subsec') * 1000 WHERE singleton = 1 AND EXISTS (SELECT 1 FROM delivery);`,
		);
	}

	sql.push(
		`UPDATE raw_deliveries SET transform_status = 'complete' WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'pending';`,
	);
	return `${sql.join("\n")}\n`;
}

function nullFlag(value) {
	return value === null ? 1 : 0;
}

export function buildReconciliationSql({ payloadSha256, normalized }) {
	const sql = [
		"PRAGMA foreign_keys = ON;",
		"CREATE TABLE local_reconciliation_assertion (value INTEGER NOT NULL CHECK (value = 0)) STRICT;",
		"CREATE TABLE local_expected_metric_sample (semantic_key TEXT PRIMARY KEY, value_min_null INTEGER NOT NULL, value_max_null INTEGER NOT NULL, source_name_null INTEGER NOT NULL) WITHOUT ROWID, STRICT;",
	];

	for (const batch of batches(normalized.metricSamples, 500)) {
		const rows = batch
			.map(
				(sample) =>
					`(${sqlText(sample.semanticKey)}, ${nullFlag(sample.valueMin)}, ${nullFlag(sample.valueMax)}, ${nullFlag(sample.sourceName)})`,
			)
			.join(",\n");
		sql.push(
			`INSERT INTO local_expected_metric_sample (semantic_key, value_min_null, value_max_null, source_name_null) VALUES\n${rows};`,
		);
	}

	sql.push(
		"INSERT INTO local_reconciliation_assertion SELECT COUNT(*) FROM local_expected_metric_sample AS expected LEFT JOIN metric_samples AS actual USING (semantic_key) WHERE actual.semantic_key IS NULL OR (expected.value_min_null = 1 AND actual.value_min IS NOT NULL) OR (expected.value_max_null = 1 AND actual.value_max IS NOT NULL) OR (expected.source_name_null = 1 AND actual.source_name IS NOT NULL);",
		"CREATE TABLE local_expected_sleep_summary (semantic_key TEXT PRIMARY KEY, sleep_start_ms_null INTEGER NOT NULL, sleep_end_ms_null INTEGER NOT NULL, total_sleep_hours_null INTEGER NOT NULL, awake_hours_null INTEGER NOT NULL, core_hours_null INTEGER NOT NULL, deep_hours_null INTEGER NOT NULL, rem_hours_null INTEGER NOT NULL, source_name_null INTEGER NOT NULL) WITHOUT ROWID, STRICT;",
	);

	for (const batch of batches(normalized.sleepSummaries, 500)) {
		const rows = batch
			.map(
				(sleep) =>
					`(${sqlText(sleep.semanticKey)}, ${nullFlag(sleep.sleepStartMs)}, ${nullFlag(sleep.sleepEndMs)}, ${nullFlag(sleep.totalSleepHours)}, ${nullFlag(sleep.awakeHours)}, ${nullFlag(sleep.coreHours)}, ${nullFlag(sleep.deepHours)}, ${nullFlag(sleep.remHours)}, ${nullFlag(sleep.sourceName)})`,
			)
			.join(",\n");
		sql.push(
			`INSERT INTO local_expected_sleep_summary (semantic_key, sleep_start_ms_null, sleep_end_ms_null, total_sleep_hours_null, awake_hours_null, core_hours_null, deep_hours_null, rem_hours_null, source_name_null) VALUES\n${rows};`,
		);
	}

	sql.push(
		"INSERT INTO local_reconciliation_assertion SELECT COUNT(*) FROM local_expected_sleep_summary AS expected LEFT JOIN sleep_summaries AS actual USING (semantic_key) WHERE actual.semantic_key IS NULL OR (expected.sleep_start_ms_null = 1 AND actual.sleep_start_ms IS NOT NULL) OR (expected.sleep_end_ms_null = 1 AND actual.sleep_end_ms IS NOT NULL) OR (expected.total_sleep_hours_null = 1 AND actual.total_sleep_hours IS NOT NULL) OR (expected.awake_hours_null = 1 AND actual.awake_hours IS NOT NULL) OR (expected.core_hours_null = 1 AND actual.core_hours IS NOT NULL) OR (expected.deep_hours_null = 1 AND actual.deep_hours IS NOT NULL) OR (expected.rem_hours_null = 1 AND actual.rem_hours IS NOT NULL) OR (expected.source_name_null = 1 AND actual.source_name IS NOT NULL);",
		`INSERT INTO local_reconciliation_assertion SELECT CASE WHEN COUNT(*) = 1 THEN 0 ELSE 1 END FROM raw_deliveries WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'complete';`,
		...buildTouchedRollupReconciliationSql(normalized.metricSamples),
		"INSERT INTO local_reconciliation_assertion SELECT COUNT(*) FROM pragma_foreign_key_check;",
		"DROP TABLE local_expected_sleep_summary;",
		"DROP TABLE local_expected_metric_sample;",
		"DROP TABLE local_reconciliation_assertion;",
	);
	return `${sql.join("\n")}\n`;
}

async function reconcileLocalImport({ target, payloadSha256, normalized, run, sqlFile }) {
	await fs.writeFile(sqlFile, buildReconciliationSql({ payloadSha256, normalized }), {
		mode: 0o600,
	});
	try {
		await run({ target, file: sqlFile });
	} catch {
		throw new Error("local_reconciliation_failed");
	}
}

export async function processFile(filePath, options, { run = runD1 } = {}) {
	const startedAt = performance.now();
	const [bytes, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
	const payloadSha256 = createHash("sha256").update(bytes).digest("hex");
	const manifest = HEALTH_EXPORT_MANIFEST_BY_HASH.get(payloadSha256);
	if (manifest && manifest.sizeBytes !== bytes.byteLength)
		throw new Error("manifest_size_mismatch");
	const objectKey = manifest?.objectKey ?? path.basename(filePath);
	const normalized = normalizeHealthAutoExport(JSON.parse(bytes.toString("utf8")));
	const report = {
		file: path.basename(filePath),
		objectKey,
		payloadSha256,
		bytes: bytes.byteLength,
		inputRows: normalized.inputRows,
		ignoredRows: normalized.ignoredRows,
		ignoredMetrics: normalized.ignoredMetrics,
		metricSamples: normalized.metricSamples.length,
		sleepSummaries: normalized.sleepSummaries.length,
		exactDuplicates: normalized.exactDuplicates,
		observedStartMs: normalized.observedStartMs,
		observedEndMs: normalized.observedEndMs,
		mode: options.mode,
	};

	if (options.mode !== "dry-run") {
		const target =
			options.mode === "remote"
				? resolveD1Target({ mode: "remote", expectedDatabaseId: options.databaseId })
				: resolveD1Target({
						mode: "local",
						...(options.persistTo ? { persistTo: options.persistTo } : {}),
					});
		const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "health-transform-"));
		await fs.chmod(tempDirectory, 0o700);
		const sqlFile = path.join(tempDirectory, "import.sql");
		const reconciliationFile = path.join(tempDirectory, "reconcile.sql");
		try {
			const sql = buildSql({
				objectKey,
				payloadSha256,
				receivedAtMs: manifest?.receivedAtMs ?? Math.trunc(stats.mtimeMs),
				normalized,
				includeRollups: target.mode === "local",
			});
			await fs.writeFile(sqlFile, sql, { mode: 0o600 });
			await run({ file: sqlFile, target });
			if (target.mode === "local") {
				await reconcileLocalImport({
					target,
					payloadSha256,
					normalized,
					run,
					sqlFile: reconciliationFile,
				});
			}
		} finally {
			await fs.rm(tempDirectory, { recursive: true, force: true });
		}
	}

	console.log(JSON.stringify({ ...report, durationMs: Math.round(performance.now() - startedAt) }));
	return report;
}

export async function main(argv = process.argv.slice(2)) {
	const options = parseArguments(argv);
	if (!options) {
		usage("Invalid arguments or missing exact file paths.");
		return;
	}
	try {
		for (const filePath of options.files) await processFile(filePath, options);
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: typeof error?.code === "string" ? error.code : (error?.message ?? "unknown_error"),
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
