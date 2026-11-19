import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { handleRequest } from "../../server/index.ts";
import type { GarageEnv } from "../../server/types.ts";
// Local development uses an embedded Postgres and local photos; production uses Neon and Blob.
import { localEnv } from "./local-env.mjs";

export function localApi(): Plugin {
	return {
		name: "garage-local-api",
		apply: "serve",
		async configureServer(server) {
			const app = fileURLToPath(new URL("../..", import.meta.url));
			const content = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
			const passwordHash = content.match(/^ADMIN_PASSWORD_HASH='([^']+)'/m)?.[1];
			const env = (await localEnv(app, passwordHash)) as GarageEnv;
			server.httpServer?.on("close", () => {
				void (env.db as GarageEnv["db"] & { close(): Promise<void> }).close();
			});
			server.middlewares.use(async (incoming, outgoing, next) => {
				if (!incoming.url?.startsWith("/api/")) {
					next();
					return;
				}
				try {
					const chunks: Buffer[] = [];
					let size = 0;
					for await (const chunk of incoming) {
						size += chunk.length;
						if (size > 4 * 1024 * 1024) {
							outgoing.writeHead(413, { "Content-Type": "application/json" });
							outgoing.end(JSON.stringify({ error: "Choose a photo under 4 MB." }));
							return;
						}
						chunks.push(chunk);
					}
					const headers = new Headers();
					for (const [key, value] of Object.entries(incoming.headers))
						if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
					const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
						method: incoming.method,
						headers,
						...(!["GET", "HEAD"].includes(incoming.method ?? "GET")
							? { body: Buffer.concat(chunks) }
							: {}),
					});
					const response = await handleRequest(request, env);
					outgoing.writeHead(response.status, Object.fromEntries(response.headers));
					outgoing.end(Buffer.from(await response.arrayBuffer()));
				} catch {
					outgoing.writeHead(500, { "Content-Type": "application/json" });
					outgoing.end(
						JSON.stringify({ error: "Local preview failed. Restart the preview server." }),
					);
				}
			});
		},
	};
}
