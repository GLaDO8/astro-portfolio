import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveD1Target, runD1, runD1MigrationsApply } from "./d1-runner.mjs";
import { METRIC_DEFINITIONS } from "./metric-definitions.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MEDICAL_MIGRATION = path.join(
	PROJECT_ROOT,
	"workers/health-ingest/migrations/0001_medical_metrics.sql",
);
const HEALTH_MIGRATIONS = [
	path.join(
		PROJECT_ROOT,
		"workers/health-ingest/migrations/health-auto-export/0001_health_auto_export.sql",
	),
	path.join(
		PROJECT_ROOT,
		"workers/health-ingest/migrations/health-auto-export/0002_add_weight_body_mass.sql",
	),
	path.join(
		PROJECT_ROOT,
		"workers/health-ingest/migrations/health-auto-export/0003_metric_rollups.sql",
	),
];
const USER_TABLES = [
	"medical_metrics",
	"metric_definitions",
	"metric_rollups",
	"metric_rollup_state",
	"metric_samples",
	"raw_deliveries",
	"sleep_summaries",
];

const EXPECTED_COLUMNS = {
	medical_metrics: [
		["metric_code", "TEXT", 1, 1],
		["collected_at_ms", "INTEGER", 1, 2],
		["value", "REAL", 1, 0],
		["unit", "TEXT", 1, 0],
		["qualifier", "TEXT", 0, 0],
	],
	raw_deliveries: [
		["id", "INTEGER", 0, 1],
		["object_key", "TEXT", 1, 0],
		["payload_sha256", "TEXT", 1, 0],
		["received_at_ms", "INTEGER", 1, 0],
		["observed_start_ms", "INTEGER", 1, 0],
		["observed_end_ms", "INTEGER", 1, 0],
		["transform_status", "TEXT", 1, 0],
	],
	metric_definitions: [
		["id", "INTEGER", 0, 1],
		["code", "TEXT", 1, 0],
		["unit", "TEXT", 1, 0],
		["rollup_method", "TEXT", 1, 0],
	],
	metric_samples: [
		["id", "INTEGER", 0, 1],
		["delivery_id", "INTEGER", 1, 0],
		["metric_id", "INTEGER", 1, 0],
		["observed_at_ms", "INTEGER", 1, 0],
		["local_date", "TEXT", 1, 0],
		["utc_offset_minutes", "INTEGER", 1, 0],
		["value", "REAL", 1, 0],
		["value_min", "REAL", 0, 0],
		["value_max", "REAL", 0, 0],
		["source_name", "TEXT", 0, 0],
		["semantic_key", "TEXT", 1, 0],
	],
	metric_rollups: [
		["metric_id", "INTEGER", 1, 1],
		["grain", "TEXT", 1, 2],
		["period_start", "TEXT", 1, 3],
		["sample_count", "INTEGER", 1, 0],
		["value_sum", "REAL", 1, 0],
		["value_min", "REAL", 1, 0],
		["value_max", "REAL", 1, 0],
		["latest_value", "REAL", 1, 0],
		["latest_observed_at_ms", "INTEGER", 1, 0],
		["latest_sample_id", "INTEGER", 1, 0],
		["aggregation_version", "INTEGER", 1, 0],
	],
	metric_rollup_state: [
		["singleton", "INTEGER", 0, 1],
		["aggregation_version", "INTEGER", 1, 0],
		["status", "TEXT", 1, 0],
		["data_revision", "INTEGER", 1, 0],
		["last_complete_delivery_id", "INTEGER", 0, 0],
		["first_local_date", "TEXT", 0, 0],
		["last_local_date", "TEXT", 0, 0],
		["refreshed_at_ms", "INTEGER", 1, 0],
	],
	sleep_summaries: [
		["id", "INTEGER", 0, 1],
		["delivery_id", "INTEGER", 1, 0],
		["local_date", "TEXT", 1, 0],
		["sleep_start_ms", "INTEGER", 0, 0],
		["sleep_end_ms", "INTEGER", 0, 0],
		["total_sleep_hours", "REAL", 0, 0],
		["awake_hours", "REAL", 0, 0],
		["core_hours", "REAL", 0, 0],
		["deep_hours", "REAL", 0, 0],
		["rem_hours", "REAL", 0, 0],
		["source_name", "TEXT", 0, 0],
		["semantic_key", "TEXT", 1, 0],
	],
};

function resultRows(payload, index) {
	const rows = payload?.[index]?.results;
	if (!Array.isArray(rows)) throw new Error("local_d1_verification_failed");
	return rows;
}

function normalizeSchemaSql(sql) {
	return String(sql).replace(/;\s*$/, "").replace(/\s+/g, " ").trim();
}

async function expectedSchemaObjects() {
	const files = await Promise.all(
		[MEDICAL_MIGRATION, ...HEALTH_MIGRATIONS].map((file) => fs.readFile(file, "utf8")),
	);
	const objects = new Map();
	for (const sql of files) {
		for (const match of sql.matchAll(
			/CREATE\s+(?:TABLE|TRIGGER)\s+([a-z0-9_]+)[\s\S]*?(?=\n\n(?:CREATE|INSERT)|$)/gi,
		)) {
			objects.set(match[1], normalizeSchemaSql(match[0]));
		}
		for (const match of sql.matchAll(/CREATE\s+INDEX\s+([a-z0-9_]+)[^;\n]*;/gi)) {
			objects.set(match[1], normalizeSchemaSql(match[0]));
		}
	}
	return objects;
}

function columnQuery() {
	return `SELECT tables.name AS table_name, columns.name, columns.type, columns."notnull" AS is_not_null, columns.pk
FROM sqlite_schema AS tables
JOIN pragma_table_info(tables.name) AS columns
WHERE tables.name IN (${USER_TABLES.map((table) => `'${table}'`).join(", ")})`;
}

async function inspectLocal(target, run) {
	return run({
		target,
		json: true,
		command:
			"SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name; PRAGMA foreign_keys;",
	});
}

async function verifyLocalSchema(target, run) {
	const payload = await run({
		target,
		json: true,
		command: `${columnQuery()};
SELECT name FROM d1_migrations ORDER BY id;
SELECT code, unit, rollup_method FROM metric_definitions ORDER BY code;
PRAGMA foreign_key_check;
SELECT COUNT(*) AS count FROM medical_metrics;
SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;`,
	});
	const columnRows = resultRows(payload, 0);
	for (const table of USER_TABLES) {
		const actual = columnRows
			.filter((row) => row.table_name === table)
			.map((row) => [row.name, row.type, row.is_not_null, row.pk]);
		if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_COLUMNS[table])) {
			throw new Error("local_d1_schema_drift");
		}
	}

	const migrations = resultRows(payload, 1).map(({ name }) => name);
	if (
		JSON.stringify(migrations) !==
		JSON.stringify([
			"0001_health_auto_export.sql",
			"0002_add_weight_body_mass.sql",
			"0003_metric_rollups.sql",
		])
	) {
		throw new Error("local_d1_migration_drift");
	}

	const definitions = resultRows(payload, 2);
	const expectedDefinitions = METRIC_DEFINITIONS.map(({ code, unit, rollupMethod }) => ({
		code,
		unit,
		rollup_method: rollupMethod,
	})).toSorted((left, right) => left.code.localeCompare(right.code));
	if (JSON.stringify(definitions) !== JSON.stringify(expectedDefinitions)) {
		throw new Error("local_d1_definition_drift");
	}
	if (resultRows(payload, 3).length !== 0) throw new Error("local_d1_foreign_key_failure");

	const schema = resultRows(payload, 5);
	const names = new Set(schema.map(({ name }) => name));
	for (const name of [
		...USER_TABLES,
		"d1_migrations",
		"metric_samples_observed_at",
		"metric_samples_local_date",
		"sleep_summaries_local_date",
		"metric_samples_wrist_temperature_conflict",
		"metric_samples_weight_conflict",
	]) {
		if (!names.has(name)) throw new Error("local_d1_schema_incomplete");
	}
	const expectedObjects = await expectedSchemaObjects();
	for (const [name, expectedSql] of expectedObjects) {
		const actual = schema.find((object) => object.name === name);
		if (!actual || normalizeSchemaSql(actual.sql) !== expectedSql) {
			throw new Error(`local_d1_schema_drift_${name}`);
		}
	}

	return {
		tables: USER_TABLES.length,
		migrations: migrations.length,
		metricDefinitions: definitions.length,
		medicalRows: Number(resultRows(payload, 4)[0]?.count ?? -1),
	};
}

export async function bootstrapLocalD1({
	persistTo,
	run = runD1,
	migrate = runD1MigrationsApply,
} = {}) {
	const target = resolveD1Target({ mode: "local", ...(persistTo ? { persistTo } : {}) });
	const inspection = await inspectLocal(target, run);
	const schemaRows = resultRows(inspection, 0);
	const medicalTable = schemaRows.find(
		({ name, type }) => name === "medical_metrics" && type === "table",
	);
	if (medicalTable) {
		const expectedSql = normalizeSchemaSql(await fs.readFile(MEDICAL_MIGRATION, "utf8"));
		if (normalizeSchemaSql(medicalTable.sql) !== expectedSql) {
			throw new Error("local_d1_medical_schema_drift");
		}
	} else {
		await run({ target, file: MEDICAL_MIGRATION });
	}

	await migrate({ target });
	return { target, ...(await verifyLocalSchema(target, run)) };
}

export function parseBootstrapArguments(argv) {
	let persistTo;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (
			argument === "--persist-to" &&
			persistTo === undefined &&
			argv[index + 1] &&
			!argv[index + 1].startsWith("-")
		) {
			persistTo = argv[++index];
			continue;
		}
		throw new Error("bootstrap_invalid_arguments");
	}
	return { persistTo };
}

export async function main(argv = process.argv.slice(2)) {
	try {
		const report = await bootstrapLocalD1(parseBootstrapArguments(argv));
		console.log(
			JSON.stringify({
				status: "ready",
				tables: report.tables,
				migrations: report.migrations,
				metricDefinitions: report.metricDefinitions,
				medicalRows: report.medicalRows,
			}),
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				status: "failed",
				code: error instanceof Error ? error.message : "bootstrap_failed",
			}),
		);
		process.exitCode = 1;
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
