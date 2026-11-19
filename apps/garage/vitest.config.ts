import { defineConfig } from "vitest/config";
export default defineConfig({
	test: { include: ["apps/garage/test/**/*.spec.ts"], testTimeout: 15000, hookTimeout: 30000 },
});
