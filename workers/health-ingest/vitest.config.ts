import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./workers/health-ingest/wrangler.jsonc" },
			miniflare: {
				bindings: {
					HEALTH_INGEST_TOKEN: "synthetic-test-token",
				},
			},
		}),
	],
	test: {
		include: ["workers/health-ingest/test/**/*.spec.ts"],
	},
});
