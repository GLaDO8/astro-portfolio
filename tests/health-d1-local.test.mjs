import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapLocalD1 } from "../scripts/health/bootstrap-local-d1.mjs";
import { resolveD1Target, runD1, runD1MigrationsApply } from "../scripts/health/d1-runner.mjs";
import {
	buildReconciliationSql,
	buildSql,
	parseArguments,
	processFile,
} from "../scripts/health/import-health-auto-export.mjs";
import { normalizeHealthAutoExport } from "../scripts/health/normalize-health-auto-export.mjs";
import {
	HEALTH_QUERY,
	normalizeHealthQueryOutput,
	queryHealthData,
} from "../src/dev/health/healthDevIntegration.mjs";

const fixtures = path.resolve("tests/fixtures/health-auto-export");

async function withTemporaryD1(run) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "health-d1-local-test-"));
	try {
		return await run(directory);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}

function rows(payload, index = 0) {
	return payload[index].results;
}

async function counts(target) {
	const payload = await runD1({
		target,
		json: true,
		command:
			"SELECT COUNT(*) AS count FROM raw_deliveries; SELECT COUNT(*) AS count FROM metric_samples; SELECT COUNT(*) AS count FROM sleep_summaries;",
	});
	return payload.map((item) => Number(item.results[0].count));
}

test("bootstraps the composed local schema without credentials and is rerunnable", async () => {
	await withTemporaryD1(async (persistTo) => {
		const targets = [];
		const run = (input) => {
			targets.push(input.target);
			return runD1(input);
		};
		const migrate = (input) => {
			targets.push(input.target);
			return runD1MigrationsApply(input);
		};
		const first = await bootstrapLocalD1({ persistTo, run, migrate });
		const before = await runD1({
			target: first.target,
			json: true,
			command:
				"SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name; SELECT COUNT(*) AS count FROM metric_definitions;",
		});
		const second = await bootstrapLocalD1({ persistTo, run, migrate });
		const after = await runD1({
			target: second.target,
			json: true,
			command:
				"SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name; SELECT COUNT(*) AS count FROM metric_definitions;",
		});

		assert.deepEqual(
			after.map(({ results, success }) => ({ results, success })),
			before.map(({ results, success }) => ({ results, success })),
		);
		assert.equal(first.medicalRows, 0);
		assert.equal(first.metricDefinitions, 34);
		assert.equal(first.migrations, 2);
		assert.ok(targets.every((target) => target.mode === "local" && target.persistTo === persistTo));
	});
});

test("fails instead of skipping a drifted medical table", async () => {
	await withTemporaryD1(async (persistTo) => {
		const target = resolveD1Target({ mode: "local", persistTo });
		await runD1({
			target,
			command:
				"CREATE TABLE medical_metrics (metric_code TEXT PRIMARY KEY, collected_at_ms INTEGER, value REAL, unit TEXT, qualifier TEXT) STRICT;",
		});
		await assert.rejects(() => bootstrapLocalD1({ persistTo }), /local_d1_medical_schema_drift/);
	});
});

test("imports synthetic facts, preserves nulls, and replays idempotently", async () => {
	await withTemporaryD1(async (persistTo) => {
		const { target } = await bootstrapLocalD1({ persistTo });
		const options = { mode: "local", databaseId: null, persistTo };
		let temporarySqlFile;
		await processFile(path.join(fixtures, "scalar.json"), options, {
			run: async (input) => {
				if (input.file) {
					temporarySqlFile = input.file;
					assert.equal((await fs.stat(input.file)).mode & 0o777, 0o600);
					assert.equal((await fs.stat(path.dirname(input.file))).mode & 0o777, 0o700);
				}
				return runD1(input);
			},
		});
		await assert.rejects(() => fs.stat(temporarySqlFile), { code: "ENOENT" });
		for (const name of ["sleep.json", "weight.json"]) {
			await processFile(path.join(fixtures, name), options);
		}
		const beforeOverlap = await counts(target);
		const overlap = JSON.parse(await fs.readFile(path.join(fixtures, "scalar.json"), "utf8"));
		overlap.data.metrics[0].data.push({
			date: "2026-01-01 10:02:00 +0530",
			qty: 7,
			source: "Synthetic Watch",
		});
		const overlapFile = path.join(persistTo, "overlap.json");
		await fs.writeFile(overlapFile, JSON.stringify(overlap), { mode: 0o600 });
		await processFile(overlapFile, options);
		const afterOverlap = await counts(target);
		assert.deepEqual(afterOverlap, [beforeOverlap[0] + 1, beforeOverlap[1] + 1, beforeOverlap[2]]);
		const beforeReplay = await counts(target);
		await processFile(path.join(fixtures, "scalar.json"), options);
		assert.deepEqual(await counts(target), beforeReplay);

		const payload = await runD1({
			target,
			json: true,
			command:
				"SELECT DISTINCT transform_status FROM raw_deliveries; SELECT sleep_start_ms, awake_hours, source_name FROM sleep_summaries WHERE local_date = '2026-01-04'; PRAGMA foreign_key_check;",
		});
		assert.deepEqual(rows(payload, 0), [{ transform_status: "complete" }]);
		assert.deepEqual(rows(payload, 1), [
			{ sleep_start_ms: null, awake_hours: null, source_name: null },
		]);
		assert.deepEqual(rows(payload, 2), []);

		const dashboard = await queryHealthData(target);
		assert.deepEqual(Object.keys(dashboard), [
			"activity",
			"recovery",
			"sleep",
			"vo2Max",
			"medical",
			"weight",
		]);
		assert.deepEqual(dashboard.medical, []);
	});
});

test("a late database conflict rolls back the delivery and earlier facts", async () => {
	await withTemporaryD1(async (persistTo) => {
		const { target } = await bootstrapLocalD1({ persistTo });
		const options = { mode: "local", databaseId: null, persistTo };
		await processFile(path.join(fixtures, "weight.json"), options);
		const before = await counts(target);

		const scalar = JSON.parse(await fs.readFile(path.join(fixtures, "scalar.json"), "utf8"));
		const weight = JSON.parse(await fs.readFile(path.join(fixtures, "weight.json"), "utf8"));
		weight.data.metrics[0].data[0].qty = 71;
		const payload = {
			data: { metrics: [...scalar.data.metrics, ...weight.data.metrics] },
		};
		const normalized = normalizeHealthAutoExport(payload);
		const payloadBytes = Buffer.from(JSON.stringify(payload));
		const payloadSha256 = createHash("sha256").update(payloadBytes).digest("hex");
		const sql = buildSql({
			objectKey: "synthetic-atomicity.json",
			payloadSha256,
			receivedAtMs: 1,
			normalized,
		});
		const sqlFile = path.join(persistTo, "atomicity.sql");
		await fs.writeFile(sqlFile, sql, { mode: 0o600 });
		await assert.rejects(() => runD1({ target, file: sqlFile }), /d1_execute_failed/);
		assert.deepEqual(await counts(target), before);
		const delivery = await runD1({
			target,
			json: true,
			command: `SELECT transform_status FROM raw_deliveries WHERE payload_sha256 = '${payloadSha256}';`,
		});
		assert.deepEqual(rows(delivery), []);
	});
});

test("dashboard query returns six result sets against an empty composed database", async () => {
	await withTemporaryD1(async (persistTo) => {
		const { target } = await bootstrapLocalD1({ persistTo });
		const payload = await runD1({ target, command: HEALTH_QUERY, json: true });
		const normalized = normalizeHealthQueryOutput(payload);
		assert.deepEqual(normalized.medical, []);
		assert.equal(payload.length, 6);
	});
});

test("import argument parsing preserves dry/local/remote safety distinctions", () => {
	assert.equal(parseArguments(["--", "fixture.json"]).mode, "dry-run");
	assert.equal(parseArguments(["--local", "fixture.json"]).mode, "local");
	assert.equal(parseArguments(["--persist-to", ".tmp/d1", "fixture.json"]), null);
	assert.equal(parseArguments(["--local", "--persist-to"]), null);
	assert.equal(parseArguments(["--local", "--database-id"]), null);
	assert.equal(parseArguments(["--remote", "fixture.json"]), null);
});

test("local reconciliation uses bounded staging inserts and database assertions", () => {
	const metricSamples = Array.from({ length: 1001 }, (_, index) => ({
		semanticKey: `metric-${index}`,
		valueMin: null,
		valueMax: index % 2 === 0 ? null : index,
		sourceName: null,
	}));
	const sql = buildReconciliationSql({
		payloadSha256: "payload-hash",
		normalized: { metricSamples, sleepSummaries: [] },
	});
	assert.equal((sql.match(/INSERT INTO local_expected_metric_sample/g) ?? []).length, 3);
	assert.match(sql, /LEFT JOIN metric_samples AS actual USING \(semantic_key\)/);
	assert.match(sql, /pragma_foreign_key_check/);
	assert.match(sql, /transform_status = 'complete'/);
});
