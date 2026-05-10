import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const figureComponent = readFileSync("src/components/mdoc/Figure.astro", "utf8");

test("Figure inset edge overlay creates a pseudo-element", () => {
	assert.match(figureComponent, /\.figure-media-stroked::after\s*\{/);
	assert.match(figureComponent, /content:\s*""/);
	assert.match(figureComponent, /box-shadow:\s*inset 0 0 0 1\.5px rgb/);
});

test("Figure can omit the image edge stroke", () => {
	assert.match(figureComponent, /noStroke\?: boolean/);
	assert.match(figureComponent, /!noStroke && "figure-media-stroked"/);
	assert.doesNotMatch(figureComponent, /\.figure-media::after\s*\{/);
});

test("Figure can omit rounded image corners with the stroke", () => {
	assert.match(figureComponent, /!noStroke && "figure-media-rounded"/);
	assert.match(figureComponent, /const imageClass = cn\("w-full", !noStroke && "rounded-xl"\)/);
});
