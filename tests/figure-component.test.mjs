import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const figureComponent = readFileSync("src/components/mdoc/Figure.astro", "utf8");

test("Figure inset edge overlay creates a pseudo-element", () => {
	assert.match(figureComponent, /\.figure-media::after\s*\{/);
	assert.match(figureComponent, /content:\s*""/);
	assert.match(figureComponent, /box-shadow:\s*inset 0 0 0 1\.5px rgb/);
});
