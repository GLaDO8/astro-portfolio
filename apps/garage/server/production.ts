import { BlobNotFoundError, head, put } from "@vercel/blob";
import { attachDatabasePool, ipAddress } from "@vercel/functions";
import { Pool } from "pg";
import type { Database, GarageEnv } from "./types.ts";

let pool: Pool | undefined;
export function productionEnv(): GarageEnv {
	if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN)
		throw new Error("Garage storage is not configured.");
	if (!pool) {
		pool = new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 5000,
			connectionTimeoutMillis: 10000,
		});
		attachDatabasePool(pool);
	}
	const activePool = pool;
	const db: Database = {
		async query<T>(sql: string, params: unknown[] = []) {
			const result = await activePool.query(sql, params);
			return { rows: result.rows as T[], rowCount: result.rowCount };
		},
	};
	return {
		db,
		passwordHash: process.env.ADMIN_PASSWORD_HASH,
		clientIp: (request) => ipAddress(request) ?? "unknown",
		photos: {
			async put(key, data, contentType) {
				await put(`garage/${key}`, Buffer.from(data), {
					access: "public",
					contentType,
					addRandomSuffix: false,
				});
			},
			async exists(key) {
				try {
					await head(`garage/${key}`);
					return true;
				} catch (error) {
					if (error instanceof BlobNotFoundError) return false;
					throw error;
				}
			},
			async get(key) {
				try {
					const photo = await head(`garage/${key}`);
					return new Response(null, {
						status: 302,
						headers: {
							Location: photo.url,
							"Cache-Control": "public, max-age=3600",
							"X-Content-Type-Options": "nosniff",
						},
					});
				} catch (error) {
					if (error instanceof BlobNotFoundError) return null;
					throw error;
				}
			},
		},
	};
}
