import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync("src/styles/global.css", "utf8");
const markdocConfig = readFileSync("markdoc.config.ts", "utf8");

test("content grid preserves floated sidenotes", () => {
	assert.doesNotMatch(globalCss, /\.content-grid\s*>\s*article\s*\{[^}]*display:\s*grid/s);
});

test("content grid expands only top-level media and code blocks", () => {
	assert.match(
		globalCss,
		/\.content-grid\s*>\s*article\s*>\s*:is\(\.figure-wide,\s*\.codeblock-reset\),\s*\.content-grid\s*>\s*article\s*>\s*p:has\(>\s*img\)/,
	);
});

test("sidenote image alt text is part of the Markdoc contract", () => {
	assert.match(markdocConfig, /imageAlt:\s*\{\s*type:\s*String\s*\}/);
});
