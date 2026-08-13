import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { HEALTH_EXPORT_MANIFEST_BY_HASH } from "./health-export-manifest.mjs";
import { normalizeHealthAutoExport } from "./normalize-health-auto-export.mjs";

const DATABASE_NAME = "health-processed-data";
const DATABASE_ID = "7f570a9a-fab7-4f17-a69a-c7717320802f";
const CONFIG_PATH = "workers/health-ingest/wrangler.jsonc";

function usage(message) {
	if (message) console.error(message);
	console.error(
		"Usage: node scripts/health/import-health-auto-export.mjs [--local|--remote --database-id ID] [--persist-to DIR] <exact-json-path>...",
	);
	process.exitCode = 2;
}

function parseArguments(argv) {
	let mode = "dry-run";
	let databaseId = null;
	let persistTo = null;
	const files = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--local" || argument === "--remote") mode = argument.slice(2);
		else if (argument === "--database-id") databaseId = argv[++index];
		else if (argument === "--persist-to") persistTo = argv[++index];
		else if (argument.startsWith("-")) return null;
		else files.push(argument);
	}
	if (files.length === 0) return null;
	if (mode === "remote" && databaseId !== DATABASE_ID) return null;
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

function buildSql({ objectKey, payloadSha256, receivedAtMs, normalized }) {
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

	sql.push(
		`UPDATE raw_deliveries SET transform_status = 'complete' WHERE payload_sha256 = ${sqlText(payloadSha256)} AND transform_status = 'pending';`,
	);
	return `${sql.join("\n")}\n`;
}

function executeSql(sqlFile, { mode, persistTo }) {
	const args = [
		"d1",
		"execute",
		DATABASE_NAME,
		"--config",
		CONFIG_PATH,
		`--${mode}`,
		"--file",
		sqlFile,
	];
	if (persistTo) args.push("--persist-to", persistTo);
	const result = spawnSync(path.resolve("node_modules/.bin/wrangler"), args, {
		encoding: "utf8",
		env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.status !== 0) throw new Error("d1_execute_failed");
}

async function processFile(filePath, options) {
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
		metricSamples: normalized.metricSamples.length,
		sleepSummaries: normalized.sleepSummaries.length,
		exactDuplicates: normalized.exactDuplicates,
		observedStartMs: normalized.observedStartMs,
		observedEndMs: normalized.observedEndMs,
		mode: options.mode,
	};

	if (options.mode !== "dry-run") {
		const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "health-transform-"));
		await fs.chmod(tempDirectory, 0o700);
		const sqlFile = path.join(tempDirectory, "import.sql");
		try {
			const sql = buildSql({
				objectKey,
				payloadSha256,
				receivedAtMs: manifest?.receivedAtMs ?? Math.trunc(stats.mtimeMs),
				normalized,
			});
			await fs.writeFile(sqlFile, sql, { mode: 0o600 });
			executeSql(sqlFile, options);
		} finally {
			await fs.rm(tempDirectory, { recursive: true, force: true });
		}
	}

	console.log(JSON.stringify({ ...report, durationMs: Math.round(performance.now() - startedAt) }));
	return report;
}

const options = parseArguments(process.argv.slice(2));
if (!options) {
	usage("Invalid arguments or missing exact file paths.");
} else {
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
