import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const D1_DATABASE_NAME = "health-processed-data";
export const PRODUCTION_DATABASE_ID = "7f570a9a-fab7-4f17-a69a-c7717320802f";
export const WRANGLER_PATH = path.join(PROJECT_ROOT, "node_modules/.bin/wrangler");
export const WRANGLER_CONFIG_PATH = path.join(PROJECT_ROOT, "workers/health-ingest/wrangler.jsonc");
export const CANONICAL_LOCAL_PERSIST_PATH = path.join(
	PROJECT_ROOT,
	"workers/health-ingest/.wrangler/dashboard-local",
);

export class D1RunnerError extends Error {
	constructor(code) {
		super(code);
		this.name = "D1RunnerError";
		this.code = code;
	}
}

function fail(code) {
	throw new D1RunnerError(code);
}

export function resolveD1Target(input) {
	if (input === undefined) {
		return { mode: "local", persistTo: CANONICAL_LOCAL_PERSIST_PATH };
	}
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		fail("d1_invalid_target");
	}

	if (input.mode === "local") {
		if ("expectedDatabaseId" in input) fail("d1_invalid_local_target");
		if (
			"persistTo" in input &&
			(typeof input.persistTo !== "string" || input.persistTo.trim().length === 0)
		) {
			fail("d1_invalid_local_target");
		}

		return {
			mode: "local",
			persistTo:
				typeof input.persistTo === "string"
					? path.resolve(PROJECT_ROOT, input.persistTo)
					: CANONICAL_LOCAL_PERSIST_PATH,
		};
	}

	if (input.mode === "remote") {
		if ("persistTo" in input) fail("d1_invalid_remote_target");
		if (input.expectedDatabaseId !== PRODUCTION_DATABASE_ID) {
			fail("d1_remote_confirmation_required");
		}
		return { mode: "remote", expectedDatabaseId: PRODUCTION_DATABASE_ID };
	}

	fail("d1_invalid_target");
}

export function buildD1TargetArgs(input) {
	const target = resolveD1Target(input);
	if (target.mode === "remote") return ["--remote"];
	return ["--local", "--persist-to", target.persistTo];
}

export function buildD1ExecuteArgs({ command, file, target, json = false } = {}) {
	const hasCommand = typeof command === "string" && command.length > 0;
	const hasFile = typeof file === "string" && file.length > 0;
	if (hasCommand === hasFile || typeof json !== "boolean") {
		fail("d1_invalid_execute_input");
	}

	const args = [
		"d1",
		"execute",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		...buildD1TargetArgs(target),
	];
	if (json) args.push("--json");
	if (hasCommand) args.push("--command", command);
	else args.push("--file", path.resolve(PROJECT_ROOT, file));
	return args;
}

async function executeWrangler(args, execute, failureCode) {
	const options = {
		cwd: PROJECT_ROOT,
		encoding: "utf8",
		env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
		maxBuffer: 10 * 1024 * 1024,
	};

	let result;
	try {
		result = await execute(WRANGLER_PATH, args, options);
	} catch {
		fail(failureCode);
	}
	if (typeof result?.status === "number" && result.status !== 0) fail(failureCode);
	return typeof result?.stdout === "string" ? result.stdout : String(result?.stdout ?? "");
}

export async function runD1({ command, file, target, json = false, execute = execFileAsync } = {}) {
	const args = buildD1ExecuteArgs({ command, file, target, json });
	const stdout = await executeWrangler(args, execute, "d1_execute_failed");
	if (!json) return stdout;

	try {
		return JSON.parse(stdout);
	} catch {
		fail("d1_invalid_json");
	}
}

export async function runD1MigrationsApply({ target, execute = execFileAsync } = {}) {
	const args = [
		"d1",
		"migrations",
		"apply",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		...buildD1TargetArgs(target),
	];
	return executeWrangler(args, execute, "d1_migrations_failed");
}

export async function runD1Export({ target, outputFile, execute = execFileAsync } = {}) {
	const resolvedTarget = resolveD1Target(target);
	if (resolvedTarget.mode !== "remote") fail("d1_remote_export_required");
	if (typeof outputFile !== "string" || outputFile.length === 0) fail("d1_invalid_export_path");

	const args = [
		"d1",
		"export",
		D1_DATABASE_NAME,
		"--config",
		WRANGLER_CONFIG_PATH,
		...buildD1TargetArgs(resolvedTarget),
		"--output",
		path.resolve(PROJECT_ROOT, outputFile),
		"--skip-confirmation",
	];
	return executeWrangler(args, execute, "d1_export_failed");
}
