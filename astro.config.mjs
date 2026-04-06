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
			name: "Zilla Slab",
			cssVariable: "--font-zilla-slab",
			fallbacks: ["serif"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/ZillaSlab-Light.woff2"],
						weight: 300,
						style: "normal",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-LightItalic.woff2"],
						weight: 300,
						style: "italic",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-Regular.woff2"],
						weight: 400,
						style: "normal",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-MediumItalic.woff2"],
						weight: 500,
						style: "italic",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-SemiBold.woff2"],
						weight: 600,
						style: "normal",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-SemiBoldItalic.woff2"],
						weight: 600,
						style: "italic",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-Bold.woff2"],
						weight: 700,
						style: "normal",
						display: "optional",
					},
					{
						src: ["./src/assets/fonts/ZillaSlab-BoldItalic.woff2"],
						weight: 700,
						style: "italic",
						display: "optional",
					},
				],
			},
		},
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
						display: "optional",
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
						style: "oblique",
						display: "optional",
					},
				],
			},
		},
	],
	prefetch: {
		prefetchAll: true,
	},
	vite: {
		plugins: [tailwindcss()],
	},
	output: "static",
});
