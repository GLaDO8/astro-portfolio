import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export async function localEnv(appPath, passwordHash) {
	const storage = path.join(appPath, ".local-data");
	const photosPath = path.join(storage, "photos");
	await mkdir(photosPath, { recursive: true });
	const database = await PGlite.create(path.join(storage, "postgres"));
	await database.exec(await readFile(path.join(appPath, "migrations/0001_garage.sql"), "utf8"));
	return {
		db: database,
		passwordHash,
		demo: true,
		clientIp: () => "local-preview",
		photos: {
			async put(key, data) {
				await writeFile(path.join(photosPath, key), data);
			},
			async exists(key) {
				try {
					await readFile(path.join(photosPath, key));
					return true;
				} catch (error) {
					if (error.code === "ENOENT") return false;
					throw error;
				}
			},
			async get(key) {
				try {
					const bytes = await readFile(path.join(photosPath, key));
					const ext = key.split(".").pop();
					return new Response(bytes, {
						headers: {
							"Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
							"Cache-Control": "public, max-age=3600",
						},
					});
				} catch (error) {
					if (error.code === "ENOENT") return null;
					throw error;
				}
			},
		},
	};
}
