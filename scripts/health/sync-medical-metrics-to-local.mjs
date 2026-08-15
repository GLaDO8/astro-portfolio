import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { bootstrapLocalD1 } from "./bootstrap-local-d1.mjs";
import {
	CANONICAL_LOCAL_PERSIST_PATH,
	PRODUCTION_DATABASE_ID,
	resolveD1Target,
	runD1,
} from "./d1-runner.mjs";

export const MEDICAL_METRICS_QUERY =
	"SELECT metric_code, collected_at_ms, value, unit, qualifier FROM medical_metrics ORDER BY metric_code, collected_at_ms;";

const QUALIFIERS = new Set([null, "<", "<=", ">", ">="]);

export class MedicalSyncError extends Error {
	constructor(code) {
		super(code);
		this.name = "MedicalSyncError";
		this.code = code;
	}
}

function fail(code) {
	throw new MedicalSyncError(code);
}

function sqlText(value) {
	if (value === null) return "NULL";
	return `'${value.replaceAll("'", "''")}'`;
}

function resultRows(payload) {
	if (!Array.isArray(payload) || payload.length !== 1 || !Array.isArray(payload[0]?.results)) {
		fail("medical_sync_invalid_remote_rows");
	}
	return payload[0].results;
}

function normalizeRows(payload) {
	const rows = resultRows(payload);
	if (rows.length === 0) fail("medical_sync_invalid_remote_rows");

	const keys = new Set();
	return rows.map((row) => {
		if (
			typeof row?.metric_code !== "string" ||
			row.metric_code.length === 0 ||
			!Number.isSafeInteger(row.collected_at_ms) ||
			!Number.isFinite(row.value) ||
			typeof row.unit !== "string" ||
			row.unit.length === 0 ||
			!QUALIFIERS.has(row.qualifier)
		) {
			fail("medical_sync_invalid_remote_rows");
		}
		const key = `${row.metric_code}\u0000${row.collected_at_ms}`;
		if (keys.has(key)) fail("medical_sync_invalid_remote_rows");
		keys.add(key);
		return {
			metric_code: row.metric_code,
			collected_at_ms: row.collected_at_ms,
			value: row.value,
			unit: row.unit,
			qualifier: row.qualifier,
		};
	});
}

function batches(values, size = 100) {
	const output = [];
	for (let index = 0; index < values.length; index += size) {
		output.push(values.slice(index, index + size));
	}
	return output;
}

export function buildMedicalReplacementSql(rows) {
	const sql = ["DELETE FROM medical_metrics;"];
	for (const batch of batches(rows)) {
		const values = batch
			.map(
				(row) =>
					`(${sqlText(row.metric_code)}, ${row.collected_at_ms}, ${row.value}, ${sqlText(row.unit)}, ${sqlText(row.qualifier)})`,
			)
			.join(",\n");
		sql.push(
			`INSERT INTO medical_metrics (metric_code, collected_at_ms, value, unit, qualifier) VALUES\n${values};`,
		);
	}
	return `${sql.join("\n")}\n`;
}

export function parseMedicalSyncArguments(argv) {
	const args = argv[0] === "--" ? argv.slice(1) : argv;
	if (args.length !== 2 || args[0] !== "--database-id" || args[1] !== PRODUCTION_DATABASE_ID) {
		return null;
	}
	return { databaseId: PRODUCTION_DATABASE_ID };
}

export async function syncMedicalMetricsToLocal({
	databaseId,
	canonicalPersistPath = CANONICAL_LOCAL_PERSIST_PATH,
	run = runD1,
	bootstrap = bootstrapLocalD1,
	fsApi = fs,
} = {}) {
	if (databaseId !== PRODUCTION_DATABASE_ID) fail("medical_sync_confirmation_required");

	const remoteTarget = resolveD1Target({
		mode: "remote",
		expectedDatabaseId: databaseId,
	});
	const remoteRows = normalizeRows(
		await run({ command: MEDICAL_METRICS_QUERY, target: remoteTarget, json: true }),
	);
	const { target: localTarget } = await bootstrap({ persistTo: canonicalPersistPath });

	const tempDirectory = await fsApi.mkdtemp(path.join(os.tmpdir(), "medical-d1-sync-"));
	await fsApi.chmod(tempDirectory, 0o700);
	const sqlFile = path.join(tempDirectory, "replace-medical-metrics.sql");
	try {
		await fsApi.writeFile(sqlFile, buildMedicalReplacementSql(remoteRows), {
			mode: 0o600,
			flag: "wx",
		});
		await run({ file: sqlFile, target: localTarget });

		const localRows = normalizeRows(
			await run({ command: MEDICAL_METRICS_QUERY, target: localTarget, json: true }),
		);
		if (JSON.stringify(localRows) !== JSON.stringify(remoteRows)) {
			fail("medical_sync_reconciliation_failed");
		}
	} finally {
		await fsApi.rm(tempDirectory, { recursive: true, force: true });
	}

	const collectedAt = remoteRows.map(({ collected_at_ms: value }) => value);
	return {
		status: "complete",
		rows: remoteRows.length,
		metrics: new Set(remoteRows.map(({ metric_code: code }) => code)).size,
		firstCollectedAtMs: Math.min(...collectedAt),
		lastCollectedAtMs: Math.max(...collectedAt),
		reconciliation: "matched",
	};
}

async function main() {
	const options = parseMedicalSyncArguments(process.argv.slice(2));
	if (!options) {
		console.error(
			"Usage: node scripts/health/sync-medical-metrics-to-local.mjs --database-id <exact-production-id>",
		);
		process.exitCode = 2;
		return;
	}

	try {
		console.log(JSON.stringify(await syncMedicalMetricsToLocal(options)));
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: error instanceof MedicalSyncError ? error.code : "medical_sync_failed",
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
