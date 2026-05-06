import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const astroConfig = readFileSync("astro.config.mjs", "utf8");
const sidequestsCanvas = readFileSync("src/components/sidequests/SidequestsCanvas.tsx", "utf8");

test("sidequests pre-bundles model-viewer before the lazy CAD import runs", () => {
	assert.match(sidequestsCanvas, /import\("@google\/model-viewer"\)/);
	assert.match(astroConfig, /optimizeDeps:\s*{[\s\S]*include:\s*\[[\s\S]*"@google\/model-viewer"/);
});
