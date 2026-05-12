import { readFileSync, writeFileSync } from "node:fs";
import markdoc from "@astrojs/markdoc";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

const sidequestsPageUrl = new URL("./src/pages/sidequests.astro", import.meta.url);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readRequestBody = (request) =>
	new Promise((resolve, reject) => {
		let body = "";

		request.setEncoding("utf8");
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => resolve(body));
		request.on("error", reject);
	});

const updateSidequestItemClass = (source, item) => {
	if (
		typeof item?.id !== "string" ||
		typeof item?.className !== "string" ||
		item.className.includes('"') ||
		item.className.includes("\n") ||
		item.className.includes("\r")
	) {
		throw new Error("Invalid sidequest item payload.");
	}

	const sectionPattern = new RegExp(
		`<section\\b(?=[^>]*\\bdata-sidequest-item="${escapeRegExp(item.id)}")[^>]*>`,
	);
	const match = source.match(sectionPattern);

	if (!match) {
		throw new Error(`Could not find sidequest item "${item.id}".`);
	}

	const nextSection = match[0].replace(/\bclass="[^"]*"/, `class="${item.className}"`);

	if (!/\bclass="[^"]*"/.test(match[0])) {
		throw new Error(`Could not update sidequest item "${item.id}".`);
	}

	return source.replace(match[0], nextSection);
};

const sidequestsPositionerPlugin = () => ({
	name: "sidequests-positioner-dev-server",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use("/__dev/sidequests-positioner", async (request, response, next) => {
			if (request.method !== "POST") {
				next();
				return;
			}

			try {
				const payload = JSON.parse(await readRequestBody(request));

				if (!Array.isArray(payload?.items)) {
					throw new Error("Expected an items array.");
				}

				let source = readFileSync(sidequestsPageUrl, "utf8");

				for (const item of payload.items) {
					source = updateSidequestItemClass(source, item);
				}

				writeFileSync(sidequestsPageUrl, source);

				response.statusCode = 200;
				response.setHeader("Content-Type", "application/json");
				response.end(JSON.stringify({ ok: true }));
			} catch (error) {
				response.statusCode = 400;
				response.setHeader("Content-Type", "application/json");
				response.end(
					JSON.stringify({
						ok: false,
						error: error instanceof Error ? error.message : "Unknown error.",
					}),
				);
			}
		});
	},
});

export default defineConfig({
	site: "https://shrey.fyi",
	integrations: [react(), markdoc(), sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: "Commissioner",
			cssVariable: "--font-commissioner",
			fallbacks: ["sans-serif"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/Commissioner-Variable.woff2"],
						weight: "100 900",
						style: "normal",
						stretch: "75% 125%",
						display: "swap",
					},
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: "Recursive",
			cssVariable: "--font-recursive",
			fallbacks: ["ui-monospace", "monospace"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/Recursive-Variable.woff2"],
						weight: "300 1000",
						style: "normal",
						display: "swap",
					},
				],
			},
		},
	],
	prefetch: {
		prefetchAll: true,
	},
	vite: {
		optimizeDeps: {
			include: ["@google/model-viewer"],
		},
		plugins: [tailwindcss(), sidequestsPositionerPlugin()],
	},
	output: "static",
});
