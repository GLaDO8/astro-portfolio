import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseBootstrapArguments } from "../scripts/health/bootstrap-local-d1.mjs";
import {
	buildD1ExecuteArgs,
	CANONICAL_LOCAL_PERSIST_PATH,
	D1_DATABASE_NAME,
	D1RunnerError,
	PRODUCTION_DATABASE_ID,
	resolveD1Target,
	runD1,
	runD1Export,
	runD1MigrationsApply,
	WRANGLER_CONFIG_PATH,
	WRANGLER_PATH,
} from "../scripts/health/d1-runner.mjs";
import { parseMigrationArguments } from "../scripts/health/migrate-health-d1.mjs";

test("defaults to the canonical absolute local D1 target", () => {
	assert.deepEqual(resolveD1Target(), {
		mode: "local",
		persistTo: CANONICAL_LOCAL_PERSIST_PATH,
	});
	assert.equal(path.isAbsolute(CANONICAL_LOCAL_PERSIST_PATH), true);
	assert.match(
		CANONICAL_LOCAL_PERSIST_PATH,
		/\/workers\/health-ingest\/\.wrangler\/dashboard-local$/,
	);
});

test("resolves explicit local persistence paths against the project root", () => {
	assert.deepEqual(resolveD1Target({ mode: "local", persistTo: ".tmp/isolated-d1" }), {
		mode: "local",
		persistTo: path.resolve(".tmp/isolated-d1"),
	});
});

test("requires an explicit remote mode and exact production database confirmation", () => {
	assert.deepEqual(
		resolveD1Target({ mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID }),
		{ mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID },
	);

	for (const target of [
		{ mode: "remote" },
		{ mode: "remote", expectedDatabaseId: "wrong-id" },
		{ mode: "local", expectedDatabaseId: PRODUCTION_DATABASE_ID },
		{ mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID, persistTo: ".tmp/d1" },
		{ mode: "preview" },
	]) {
		assert.throws(() => resolveD1Target(target), D1RunnerError);
	}
});

test("constructs exact local and remote execute arguments", () => {
	assert.deepEqual(buildD1ExecuteArgs({ command: "SELECT 1;" }), [
		"d1",
		"execute",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		"--local",
		"--persist-to",
		CANONICAL_LOCAL_PERSIST_PATH,
		"--command",
		"SELECT 1;",
	]);

	assert.deepEqual(
		buildD1ExecuteArgs({
			target: { mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID },
			file: "/private/tmp/import.sql",
			json: true,
		}),
		[
			"d1",
			"execute",
			D1_DATABASE_NAME,
			"--config",
			WRANGLER_CONFIG_PATH,
			"--remote",
			"--json",
			"--file",
			"/private/tmp/import.sql",
		],
	);
});

test("requires exactly one non-empty SQL command or file", () => {
	for (const input of [
		{},
		{ command: "SELECT 1;", file: "query.sql" },
		{ command: "" },
		{ file: "" },
	]) {
		assert.throws(() => buildD1ExecuteArgs(input), D1RunnerError);
	}
});

test("uses injected execution, disables metrics, and parses Wrangler JSON", async () => {
	let invocation;
	const parsed = await runD1({
		command: "SELECT 1;",
		json: true,
		execute: async (executable, args, options) => {
			invocation = { executable, args, options };
			return { stdout: '[{"results":[{"value":1}]}]', stderr: "" };
		},
	});

	assert.deepEqual(parsed, [{ results: [{ value: 1 }] }]);
	assert.equal(invocation.executable, WRANGLER_PATH);
	assert.equal(invocation.options.env.WRANGLER_SEND_METRICS, "false");
	assert.ok(invocation.args.includes("--local"));
	assert.ok(invocation.args.includes("--json"));
	assert.ok(!invocation.args.includes("--remote"));
});

test("returns stdout when JSON parsing is not requested", async () => {
	assert.equal(
		await runD1({
			file: "/private/tmp/schema.sql",
			execute: async () => ({ stdout: "applied", stderr: "" }),
		}),
		"applied",
	);
});

test("throws bounded errors without child-process details", async () => {
	const privateDetail = "SELECT private_health_value FROM secret_path";
	await assert.rejects(
		() =>
			runD1({
				command: "SELECT 1;",
				execute: async () => {
					throw new Error(privateDetail);
				},
			}),
		(error) => {
			assert.ok(error instanceof D1RunnerError);
			assert.equal(error.code, "d1_execute_failed");
			assert.ok(!error.message.includes(privateDetail));
			assert.equal(error.cause, undefined);
			return true;
		},
	);
	await assert.rejects(
		() =>
			runD1({
				command: "SELECT 1;",
				execute: async () => ({ status: 1, stdout: "", stderr: privateDetail }),
			}),
		(error) => {
			assert.ok(error instanceof D1RunnerError);
			assert.equal(error.code, "d1_execute_failed");
			assert.ok(!error.message.includes(privateDetail));
			return true;
		},
	);

	await assert.rejects(
		() =>
			runD1({
				command: "SELECT 1;",
				json: true,
				execute: async () => ({ stdout: privateDetail, stderr: "" }),
			}),
		(error) => error instanceof D1RunnerError && error.code === "d1_invalid_json",
	);
});

test("reuses the guarded target for migrations and remote exports", async () => {
	const invocations = [];
	const execute = async (executable, args, options) => {
		invocations.push({ executable, args, options });
		return { stdout: "ok", stderr: "" };
	};

	await runD1MigrationsApply({ execute });
	await runD1Export({
		target: { mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID },
		outputFile: "/private/tmp/health-export.sql",
		execute,
	});

	assert.deepEqual(invocations[0].args, [
		"d1",
		"migrations",
		"apply",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		"--local",
		"--persist-to",
		CANONICAL_LOCAL_PERSIST_PATH,
	]);
	assert.deepEqual(invocations[1].args, [
		"d1",
		"export",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		"--remote",
		"--output",
		"/private/tmp/health-export.sql",
		"--skip-confirmation",
	]);

	await assert.rejects(
		() => runD1Export({ outputFile: "/private/tmp/no.sql", execute }),
		(error) => error instanceof D1RunnerError && error.code === "d1_remote_export_required",
	);
});

test("guards local and remote migration targets", () => {
	assert.equal(parseMigrationArguments(["--local"]).target.mode, "local");
	assert.equal(
		parseMigrationArguments(["--remote", "--database-id", PRODUCTION_DATABASE_ID]).target.mode,
		"remote",
	);
	for (const argv of [
		[],
		["--remote"],
		["--remote", "--database-id", "wrong"],
		["--local", "--database-id", PRODUCTION_DATABASE_ID],
	]) {
		assert.throws(() => parseMigrationArguments(argv));
	}
});

test("fails closed on invalid bootstrap persistence arguments", () => {
	assert.deepEqual(parseBootstrapArguments([]), { persistTo: undefined });
	assert.deepEqual(parseBootstrapArguments(["--persist-to", ".tmp/d1"]), {
		persistTo: ".tmp/d1",
	});
	for (const argv of [["--persist-to"], ["--persist-to", "--remote"], ["unexpected"]]) {
		assert.throws(() => parseBootstrapArguments(argv), /bootstrap_invalid_arguments/);
	}
});

test("package commands keep normal health development local", () => {
	const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
	assert.equal(scripts["health:db:bootstrap:local"], "node scripts/health/bootstrap-local-d1.mjs");
	assert.equal(
		scripts["health:transform:local"],
		"node scripts/health/import-health-auto-export.mjs --local",
	);
	assert.doesNotMatch(scripts.dev, /remote/i);
	assert.doesNotMatch(scripts["health:db:bootstrap:local"], /remote/i);
	assert.doesNotMatch(scripts["health:transform:local"], /remote/i);
	assert.match(scripts["health:dashboard:remote"], /HEALTH_DASHBOARD_REMOTE_CONFIRM/);
	assert.match(scripts["health:db:migrate:remote"], /migrate-health-d1\.mjs --remote/);
});
