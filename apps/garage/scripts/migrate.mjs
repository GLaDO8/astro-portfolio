import { readFileSync } from "node:fs";
import { Pool } from "pg";

if (
	!process.argv.includes("--remote") ||
	process.argv[process.argv.indexOf("--confirm") + 1] !== "garage"
)
	throw new Error("Use --remote --confirm garage after reviewing the target database.");
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString || new URL(connectionString).hostname.includes("-pooler"))
	throw new Error(
		"Set DATABASE_URL_UNPOOLED to Garage’s direct database connection. Keep it out of shell history.",
	);
const pool = new Pool({ connectionString });
try {
	await pool.query(readFileSync(new URL("../migrations/0001_garage.sql", import.meta.url), "utf8"));
	console.log("Garage schema is ready.");
} finally {
	await pool.end();
}
