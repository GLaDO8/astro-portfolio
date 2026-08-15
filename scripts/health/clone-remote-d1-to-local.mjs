import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
	CANONICAL_LOCAL_PERSIST_PATH,
	PRODUCTION_DATABASE_ID,
	runD1,
	runD1Export,
} from "./d1-runner.mjs";

export const CLONE_SCHEMA_QUERY = `
SELECT type, name, tbl_name, sql
FROM sqlite_schema
WHERE substr(name, 1, 7) <> 'sqlite_'
  AND substr(name, 1, 4) <> '_cf_'
  AND substr(tbl_name, 1, 7) <> 'sqlite_'
  AND substr(tbl_name, 1, 4) <> '_cf_'
ORDER BY type, name;
`;

function sqlString(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdentifier(value) {
	return `"${value.replaceAll('"', '""')}"`;
}

export function buildCloneRowCountQuery(tableNames) {
	if (tableNames.length === 0) {
		return "SELECT CAST(NULL AS TEXT) AS table_name, 0 AS row_count WHERE false;";
	}
	return `${tableNames
		.map(
			(name) =>
				`SELECT ${sqlString(name)} AS table_name, COUNT(*) AS row_count FROM ${sqlIdentifier(name)}`,
		)
		.join(" UNION ALL\n")}\nORDER BY table_name;`;
}

export class D1CloneError extends Error {
	constructor(code) {
		super(code);
		this.name = "D1CloneError";
		this.code = code;
	}
}

function fail(code) {
	throw new D1CloneError(code);
}

async function pathExists(filePath, fsApi) {
	try {
		await fsApi.lstat(filePath);
		return true;
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

function rowsFromResult(payload) {
	const rows = payload?.[0]?.results;
	if (!Array.isArray(rows)) fail("d1_clone_invalid_reconciliation");
	return rows;
}

function normalizeSchema(rows) {
	const schema = rows.map(({ type, name, tbl_name: tableName, sql }) => {
		if (
			typeof type !== "string" ||
			typeof name !== "string" ||
			typeof tableName !== "string" ||
			name.startsWith("sqlite_") ||
			name.startsWith("_cf_") ||
			tableName.startsWith("sqlite_") ||
			tableName.startsWith("_cf_") ||
			!(typeof sql === "string" || sql === null)
		) {
			fail("d1_clone_invalid_reconciliation");
		}
		return { type, name, tableName, sql };
	});
	return schema;
}

function discoveredTables(schema) {
	return schema.filter(({ type }) => type === "table").map(({ name }) => name);
}

function normalizeCounts(rows, tableNames) {
	const counts = new Map();
	for (const row of rows) {
		if (
			typeof row?.table_name !== "string" ||
			!tableNames.includes(row.table_name) ||
			!Number.isSafeInteger(row.row_count) ||
			row.row_count < 0 ||
			counts.has(row.table_name)
		) {
			fail("d1_clone_invalid_reconciliation");
		}
		counts.set(row.table_name, row.row_count);
	}
	if (counts.size !== tableNames.length) fail("d1_clone_invalid_reconciliation");
	return Object.fromEntries(tableNames.map((name) => [name, counts.get(name)]));
}

function schemaSnapshot(payload) {
	return normalizeSchema(rowsFromResult(payload));
}

function countSnapshot(payload, tableNames) {
	return normalizeCounts(rowsFromResult(payload), tableNames);
}

function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function parseCloneArguments(argv) {
	const argumentsWithoutDelimiter = argv[0] === "--" ? argv.slice(1) : argv;
	if (
		argumentsWithoutDelimiter.length !== 2 ||
		argumentsWithoutDelimiter[0] !== "--database-id" ||
		argumentsWithoutDelimiter[1] !== PRODUCTION_DATABASE_ID
	) {
		return null;
	}
	return { databaseId: PRODUCTION_DATABASE_ID };
}

export async function cloneRemoteD1ToLocal({
	databaseId,
	canonicalPersistPath = CANONICAL_LOCAL_PERSIST_PATH,
	execute,
	fsApi = fs,
} = {}) {
	if (databaseId !== PRODUCTION_DATABASE_ID) fail("d1_clone_confirmation_required");

	const canonicalPath = path.resolve(canonicalPersistPath);
	if (await pathExists(canonicalPath, fsApi)) fail("d1_clone_local_exists");

	const canonicalParent = path.dirname(canonicalPath);
	await fsApi.mkdir(canonicalParent, { recursive: true, mode: 0o700 });
	const temporaryDirectory = await fsApi.mkdtemp(path.join(canonicalParent, ".health-d1-clone-"));
	await fsApi.chmod(temporaryDirectory, 0o700);
	const exportFile = path.join(temporaryDirectory, "remote-export.sql");
	const stagedPersistPath = path.join(temporaryDirectory, "persist");

	try {
		await fsApi.writeFile(exportFile, "", { mode: 0o600, flag: "wx" });
		await fsApi.mkdir(stagedPersistPath, { mode: 0o700 });

		const remoteTarget = {
			mode: "remote",
			expectedDatabaseId: databaseId,
		};
		await runD1Export({ target: remoteTarget, outputFile: exportFile, execute });
		await fsApi.chmod(exportFile, 0o600);
		const exportStats = await fsApi.stat(exportFile);
		if (!exportStats.isFile() || exportStats.size === 0) fail("d1_clone_empty_export");

		const remoteSchema = schemaSnapshot(
			await runD1({
				command: CLONE_SCHEMA_QUERY,
				target: remoteTarget,
				json: true,
				execute,
			}),
		);
		const tableNames = discoveredTables(remoteSchema);
		const rowCountQuery = buildCloneRowCountQuery(tableNames);
		const remoteRowCounts = countSnapshot(
			await runD1({ command: rowCountQuery, target: remoteTarget, json: true, execute }),
			tableNames,
		);

		const localTarget = { mode: "local", persistTo: stagedPersistPath };
		await runD1({ file: exportFile, target: localTarget, execute });
		const localSchema = schemaSnapshot(
			await runD1({
				command: CLONE_SCHEMA_QUERY,
				target: localTarget,
				json: true,
				execute,
			}),
		);
		const localRowCounts = countSnapshot(
			await runD1({ command: rowCountQuery, target: localTarget, json: true, execute }),
			tableNames,
		);

		if (!sameJson(remoteSchema, localSchema)) fail("d1_clone_schema_mismatch");
		if (!sameJson(remoteRowCounts, localRowCounts)) {
			fail("d1_clone_count_mismatch");
		}
		if (await pathExists(canonicalPath, fsApi)) fail("d1_clone_local_exists");

		await fsApi.rename(stagedPersistPath, canonicalPath);
		return {
			status: "complete",
			tables: tableNames,
			rowCounts: localRowCounts,
			exportBytes: exportStats.size,
			reconciliation: "matched",
		};
	} catch (error) {
		if (error instanceof D1CloneError) throw error;
		fail("d1_clone_failed");
	} finally {
		await fsApi.rm(temporaryDirectory, { recursive: true, force: true });
	}
}

async function main() {
	const options = parseCloneArguments(process.argv.slice(2));
	if (!options) {
		console.error(
			"Usage: node scripts/health/clone-remote-d1-to-local.mjs --database-id <exact-production-id>",
		);
		process.exitCode = 2;
		return;
	}

	try {
		console.log(JSON.stringify(await cloneRemoteD1ToLocal(options)));
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: error instanceof D1CloneError ? error.code : "d1_clone_failed",
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
