import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildCloneRowCountQuery,
	CLONE_SCHEMA_QUERY,
	cloneRemoteD1ToLocal,
	D1CloneError,
	parseCloneArguments,
} from "../scripts/health/clone-remote-d1-to-local.mjs";
import { PRODUCTION_DATABASE_ID } from "../scripts/health/d1-runner.mjs";

const tableNames = [
	"d1_migrations",
	"medical_metrics",
	"metric_definitions",
	"metric_samples",
	"raw_deliveries",
	"sleep_summaries",
	"unexpected_private_table",
];
const schemaRows = tableNames
	.map((name) => ({
		type: "table",
		name,
		tbl_name: name,
		sql: `CREATE TABLE ${name} (id INTEGER)`,
	}))
	.concat([
		{
			type: "index",
			name: "unexpected_private_table_index",
			tbl_name: "unexpected_private_table",
			sql: "CREATE INDEX unexpected_private_table_index ON unexpected_private_table(id)",
		},
	]);
const countRows = tableNames.map((table_name, index) => ({
	table_name,
	row_count: index + 1,
}));

function queryOutput(rows) {
	return JSON.stringify([{ results: rows }]);
}

async function withTemporaryCanonical(run) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "health-d1-clone-test-"));
	try {
		return await run({ root, canonical: path.join(root, "canonical") });
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

function createMockExecutor({ localSchema = schemaRows, localCounts = countRows, onCall } = {}) {
	const invocations = [];
	const execute = async (executable, args, options) => {
		invocations.push({ executable, args: [...args], options });
		await onCall?.({ executable, args, options, invocation: invocations.length });

		if (args[1] === "export") {
			const outputFile = args[args.indexOf("--output") + 1];
			await fs.writeFile(outputFile, "-- synthetic private export\n");
			return { stdout: "exported", stderr: "" };
		}

		if (args.includes("--file")) {
			const persistPath = args[args.indexOf("--persist-to") + 1];
			await fs.mkdir(persistPath, { recursive: true });
			await fs.writeFile(path.join(persistPath, "staged.sqlite"), "synthetic");
			return { stdout: "imported", stderr: "" };
		}

		const command = args.at(-1);
		const isSchemaQuery = command === CLONE_SCHEMA_QUERY;
		const isRemote = args.includes("--remote");
		return {
			stdout: queryOutput(
				isSchemaQuery ? (isRemote ? schemaRows : localSchema) : isRemote ? countRows : localCounts,
			),
			stderr: "",
		};
	};
	return { execute, invocations };
}

test("accepts only the exact production database confirmation", () => {
	assert.deepEqual(parseCloneArguments(["--database-id", PRODUCTION_DATABASE_ID]), {
		databaseId: PRODUCTION_DATABASE_ID,
	});
	assert.deepEqual(parseCloneArguments(["--", "--database-id", PRODUCTION_DATABASE_ID]), {
		databaseId: PRODUCTION_DATABASE_ID,
	});
	for (const argv of [
		[],
		["--database-id"],
		["--database-id", "wrong"],
		["--remote", "--database-id", PRODUCTION_DATABASE_ID],
	]) {
		assert.equal(parseCloneArguments(argv), null);
	}
});

test("fails before execution when confirmation is wrong or the canonical target exists", async () => {
	await withTemporaryCanonical(async ({ canonical }) => {
		let executions = 0;
		const execute = async () => {
			executions += 1;
		};
		await assert.rejects(
			() => cloneRemoteD1ToLocal({ databaseId: "wrong", canonicalPersistPath: canonical, execute }),
			(error) => error instanceof D1CloneError && error.code === "d1_clone_confirmation_required",
		);
		await fs.mkdir(canonical);
		await assert.rejects(
			() =>
				cloneRemoteD1ToLocal({
					databaseId: PRODUCTION_DATABASE_ID,
					canonicalPersistPath: canonical,
					execute,
				}),
			(error) => error instanceof D1CloneError && error.code === "d1_clone_local_exists",
		);
		assert.equal(executions, 0);
	});
});

test("exports read-only, reconciles every discovered table, and atomically promotes private staging", async () => {
	await withTemporaryCanonical(async ({ canonical }) => {
		let temporaryDirectory;
		let exportFile;
		const { execute, invocations } = createMockExecutor({
			onCall: async ({ args }) => {
				if (args[1] !== "export") return;
				exportFile = args[args.indexOf("--output") + 1];
				temporaryDirectory = path.dirname(exportFile);
				assert.equal((await fs.stat(temporaryDirectory)).mode & 0o777, 0o700);
				assert.equal((await fs.stat(exportFile)).mode & 0o777, 0o600);
			},
		});

		const report = await cloneRemoteD1ToLocal({
			databaseId: PRODUCTION_DATABASE_ID,
			canonicalPersistPath: canonical,
			execute,
		});

		assert.deepEqual(report, {
			status: "complete",
			tables: tableNames,
			rowCounts: Object.fromEntries(
				countRows.map(({ table_name, row_count }) => [table_name, row_count]),
			),
			exportBytes: 28,
			reconciliation: "matched",
		});
		assert.equal(await fs.readFile(path.join(canonical, "staged.sqlite"), "utf8"), "synthetic");
		await assert.rejects(() => fs.access(temporaryDirectory));
		await assert.rejects(() => fs.access(exportFile));

		assert.equal(invocations.length, 6);
		assert.equal(invocations[0].args[1], "export");
		assert.ok(invocations[0].args.includes("--remote"));
		assert.ok(!invocations[0].args.includes("--local"));
		assert.ok(invocations[1].args.includes("--remote"));
		assert.equal(invocations[1].args.at(-1), CLONE_SCHEMA_QUERY);
		assert.ok(invocations[2].args.includes("--remote"));
		assert.equal(invocations[2].args.at(-1), buildCloneRowCountQuery(tableNames));
		assert.match(invocations[2].args.at(-1), /FROM "d1_migrations"/);
		assert.match(invocations[2].args.at(-1), /FROM "unexpected_private_table"/);
		assert.ok(invocations[3].args.includes("--local"));
		assert.ok(invocations[3].args.includes("--file"));
		assert.ok(!invocations[3].args.includes("--remote"));
		assert.ok(invocations[4].args.includes("--local"));
		assert.equal(invocations[4].args.at(-1), CLONE_SCHEMA_QUERY);
		assert.ok(invocations[5].args.includes("--local"));
		assert.equal(invocations[5].args.at(-1), buildCloneRowCountQuery(tableNames));

		for (const invocation of invocations.filter(({ args }) => args.includes("--remote"))) {
			assert.equal(invocation.options.env.WRANGLER_SEND_METRICS, "false");
			if (invocation.args[1] === "execute") {
				assert.ok(invocation.args.includes("--command"));
				assert.ok(!invocation.args.includes("--file"));
				assert.doesNotMatch(
					invocation.args.at(-1),
					/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i,
				);
			}
		}
	});
});

test("quotes dynamically discovered table names as SQL values and identifiers", () => {
	assert.equal(
		buildCloneRowCountQuery([`private ' "table`]),
		`SELECT 'private '' "table' AS table_name, COUNT(*) AS row_count FROM "private ' ""table"\nORDER BY table_name;`,
	);
});

test("does not promote a staged database when schema or counts differ", async () => {
	for (const mismatch of [
		{
			localSchema: schemaRows.map((row, index) =>
				index === 0 ? { ...row, sql: `${row.sql} STRICT` } : row,
			),
			code: "d1_clone_schema_mismatch",
		},
		{
			localCounts: countRows.map((row, index) =>
				index === 0 ? { ...row, row_count: row.row_count + 1 } : row,
			),
			code: "d1_clone_count_mismatch",
		},
	]) {
		await withTemporaryCanonical(async ({ canonical }) => {
			const { execute } = createMockExecutor(mismatch);
			await assert.rejects(
				() =>
					cloneRemoteD1ToLocal({
						databaseId: PRODUCTION_DATABASE_ID,
						canonicalPersistPath: canonical,
						execute,
					}),
				(error) => error instanceof D1CloneError && error.code === mismatch.code,
			);
			await assert.rejects(() => fs.access(canonical));
			assert.deepEqual(
				(await fs.readdir(path.dirname(canonical))).filter((name) =>
					name.startsWith(".health-d1-clone-"),
				),
				[],
			);
		});
	}
});

test("rejects incomplete reconciliation output", async () => {
	await withTemporaryCanonical(async ({ canonical }) => {
		const { execute } = createMockExecutor({ localCounts: [] });
		await assert.rejects(
			() =>
				cloneRemoteD1ToLocal({
					databaseId: PRODUCTION_DATABASE_ID,
					canonicalPersistPath: canonical,
					execute,
				}),
			(error) => error instanceof D1CloneError && error.code === "d1_clone_invalid_reconciliation",
		);
		await assert.rejects(() => fs.access(canonical));
	});
});

test("cleans plaintext and staging after child-process failure", async () => {
	for (const failureInvocation of [1, 2, 3, 4, 5, 6]) {
		await withTemporaryCanonical(async ({ canonical }) => {
			let temporaryDirectory;
			const { execute } = createMockExecutor({
				onCall: async ({ args, invocation }) => {
					if (args[1] === "export") {
						temporaryDirectory = path.dirname(args[args.indexOf("--output") + 1]);
					}
					if (invocation === failureInvocation) throw new Error("private child-process detail");
				},
			});

			await assert.rejects(
				() =>
					cloneRemoteD1ToLocal({
						databaseId: PRODUCTION_DATABASE_ID,
						canonicalPersistPath: canonical,
						execute,
					}),
				(error) => {
					assert.ok(error instanceof D1CloneError);
					assert.equal(error.code, "d1_clone_failed");
					assert.doesNotMatch(error.message, /private child-process detail/);
					return true;
				},
			);
			await assert.rejects(() => fs.access(canonical));
			await assert.rejects(() => fs.access(temporaryDirectory));
		});
	}
});

test("a canonical-target race preserves the winner and discards staging", async () => {
	await withTemporaryCanonical(async ({ canonical }) => {
		const { execute } = createMockExecutor({
			onCall: async ({ invocation }) => {
				if (invocation === 6) {
					await fs.mkdir(canonical);
					await fs.writeFile(path.join(canonical, "winner"), "preserve");
				}
			},
		});
		await assert.rejects(
			() =>
				cloneRemoteD1ToLocal({
					databaseId: PRODUCTION_DATABASE_ID,
					canonicalPersistPath: canonical,
					execute,
				}),
			(error) => error instanceof D1CloneError && error.code === "d1_clone_local_exists",
		);
		assert.equal(await fs.readFile(path.join(canonical, "winner"), "utf8"), "preserve");
	});
});
