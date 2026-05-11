import markdoc from "@astrojs/markdoc";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

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
		plugins: [tailwindcss()],
	},
	output: "static",
});
