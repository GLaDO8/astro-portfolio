import markdoc from "@astrojs/markdoc";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [react(), markdoc()],
	vite: {
		plugins: [tailwindcss()],
	},
	output: "static",
});
