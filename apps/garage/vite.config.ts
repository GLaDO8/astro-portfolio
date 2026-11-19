import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { localApi } from "./src/dev/api-plugin.ts";

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [tailwindcss(), localApi()],
	build: { outDir: "dist", emptyOutDir: true },
	esbuild: { jsx: "automatic" },
});
