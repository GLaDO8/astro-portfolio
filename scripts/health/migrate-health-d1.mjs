import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PRODUCTION_DATABASE_ID, resolveD1Target, runD1MigrationsApply } from "./d1-runner.mjs";

export function parseMigrationArguments(argv) {
	let mode;
	let databaseId;
	let persistTo;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if ((argument === "--local" || argument === "--remote") && mode === undefined) {
			mode = argument.slice(2);
		} else if (
			argument === "--database-id" &&
			databaseId === undefined &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		) {
			databaseId = argv[++index];
		} else if (
			argument === "--persist-to" &&
			persistTo === undefined &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		) {
			persistTo = argv[++index];
		} else {
			throw new Error("migration_invalid_arguments");
		}
	}
	if (mode === "remote") {
		if (databaseId !== PRODUCTION_DATABASE_ID || persistTo) {
			throw new Error("migration_remote_confirmation_required");
		}
		return {
			target: resolveD1Target({
				mode: "remote",
				expectedDatabaseId: PRODUCTION_DATABASE_ID,
			}),
		};
	}
	if (mode === "local" && !databaseId) {
		return {
			target: resolveD1Target({ mode: "local", ...(persistTo ? { persistTo } : {}) }),
		};
	}
	throw new Error("migration_invalid_arguments");
}

export async function main(argv = process.argv.slice(2)) {
	try {
		const { target } = parseMigrationArguments(argv);
		await runD1MigrationsApply({ target });
		console.log(JSON.stringify({ status: "migrations_applied", target: target.mode }));
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: error instanceof Error ? error.message : "migration_failed",
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
