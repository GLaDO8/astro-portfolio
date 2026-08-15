import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PRODUCTION_DATABASE_ID } from "../scripts/health/d1-runner.mjs";
import {
	buildMedicalReplacementSql,
	MEDICAL_METRICS_QUERY,
	parseMedicalSyncArguments,
	syncMedicalMetricsToLocal,
} from "../scripts/health/sync-medical-metrics-to-local.mjs";

const remoteRows = [
	{
		metric_code: "ferritin",
		collected_at_ms: 1_700_000_000_000,
		value: 42.5,
		unit: "ng/mL",
		qualifier: null,
	},
	{
		metric_code: "vitamin_d_25_oh",
		collected_at_ms: 1_710_000_000_000,
		value: 20,
		unit: "ng/mL",
		qualifier: ">",
	},
];

function payload(rows) {
	return [{ results: rows }];
}

async function withTemporaryCanonical(run) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "medical-sync-test-"));
	try {
		return await run(path.join(root, "dashboard-local"));
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

test("requires the exact production database confirmation", () => {
	assert.deepEqual(parseMedicalSyncArguments(["--database-id", PRODUCTION_DATABASE_ID]), {
		databaseId: PRODUCTION_DATABASE_ID,
	});
	assert.deepEqual(parseMedicalSyncArguments(["--", "--database-id", PRODUCTION_DATABASE_ID]), {
		databaseId: PRODUCTION_DATABASE_ID,
	});
	for (const argv of [[], ["--database-id"], ["--database-id", "wrong"], ["--remote"]]) {
		assert.equal(parseMedicalSyncArguments(argv), null);
	}
});

test("builds a complete local replacement without losing qualifiers or quoting", () => {
	const sql = buildMedicalReplacementSql([
		...remoteRows,
		{
			metric_code: "quoted'metric",
			collected_at_ms: 1_720_000_000_000,
			value: 1,
			unit: "unit's",
			qualifier: "<",
		},
	]);
	assert.match(sql, /^DELETE FROM medical_metrics;/);
	assert.match(sql, /INSERT INTO medical_metrics/);
	assert.match(sql, /'quoted''metric'/);
	assert.match(sql, /'unit''s'/);
	assert.match(sql, /NULL/);
	assert.doesNotMatch(sql, /BEGIN|COMMIT/);
});

test("reads only remote rows, replaces local rows, reconciles exactly, and removes plaintext", async () => {
	await withTemporaryCanonical(async (canonicalPersistPath) => {
		const invocations = [];
		let sqlFile;
		const run = async (input) => {
			invocations.push(input);
			if (input.target.mode === "remote") return payload(remoteRows);
			if (input.file) {
				sqlFile = input.file;
				assert.equal((await fs.stat(path.dirname(input.file))).mode & 0o777, 0o700);
				assert.equal((await fs.stat(input.file)).mode & 0o777, 0o600);
				const sql = await fs.readFile(input.file, "utf8");
				assert.match(sql, /^DELETE FROM medical_metrics;/);
				return "";
			}
			return payload(remoteRows);
		};
		const bootstrap = async ({ persistTo }) => ({
			target: { mode: "local", persistTo },
		});

		const report = await syncMedicalMetricsToLocal({
			databaseId: PRODUCTION_DATABASE_ID,
			canonicalPersistPath,
			run,
			bootstrap,
		});

		assert.deepEqual(report, {
			status: "complete",
			rows: 2,
			metrics: 2,
			firstCollectedAtMs: 1_700_000_000_000,
			lastCollectedAtMs: 1_710_000_000_000,
			reconciliation: "matched",
		});
		assert.equal(invocations.length, 3);
		assert.equal(invocations[0].target.mode, "remote");
		assert.equal(invocations[0].command, MEDICAL_METRICS_QUERY);
		assert.match(invocations[0].command, /^SELECT\b/);
		assert.doesNotMatch(invocations[0].command, /\b(DELETE|INSERT|UPDATE|DROP|ALTER)\b/);
		assert.equal(invocations[1].target.mode, "local");
		assert.ok(invocations[1].file);
		assert.equal(invocations[2].target.mode, "local");
		await assert.rejects(() => fs.access(sqlFile), { code: "ENOENT" });
		await assert.rejects(() => fs.access(path.dirname(sqlFile)), { code: "ENOENT" });
	});
});

test("fails closed on invalid rows or reconciliation mismatch and still removes plaintext", async () => {
	for (const scenario of [
		{ remote: [{ ...remoteRows[0], value: Number.NaN }], local: [] },
		{ remote: remoteRows, local: remoteRows.slice(0, 1) },
	]) {
		await withTemporaryCanonical(async (canonicalPersistPath) => {
			let sqlFile;
			let call = 0;
			const run = async (input) => {
				call += 1;
				if (input.target.mode === "remote") return payload(scenario.remote);
				if (input.file) {
					sqlFile = input.file;
					return "";
				}
				return payload(scenario.local);
			};
			const bootstrap = async ({ persistTo }) => ({
				target: { mode: "local", persistTo },
			});

			await assert.rejects(
				() =>
					syncMedicalMetricsToLocal({
						databaseId: PRODUCTION_DATABASE_ID,
						canonicalPersistPath,
						run,
						bootstrap,
					}),
				/medical_sync_(invalid_remote_rows|reconciliation_failed)/,
			);
			if (sqlFile) await assert.rejects(() => fs.access(sqlFile), { code: "ENOENT" });
			assert.ok(call >= 1);
		});
	}
});
