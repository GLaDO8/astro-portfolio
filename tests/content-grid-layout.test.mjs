import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync("src/styles/global.css", "utf8");
const markdocConfig = readFileSync("markdoc.config.ts", "utf8");
const articleProse = readFileSync("src/lib/articleProse.ts", "utf8");
const articleProseComponent = readFileSync("src/components/mdoc/ArticleProse.astro", "utf8");

test("article prose preserves floated sidenotes", () => {
	assert.doesNotMatch(
		articleProseComponent,
		/\[data-article-prose\]\s*>\s*article\s*\{[^}]*display:\s*grid/s,
	);
});

test("article prose expands only top-level media and code blocks", () => {
	assert.match(
		articleProseComponent,
		/\[data-article-prose\]\s*>\s*article\s*>\s*:is\(\.figure-wide,\s*\.codeblock\),\s*\[data-article-prose\]\s*>\s*article\s*>\s*p:has\(>\s*img\)/,
	);
});

test("sidenote image alt text is part of the Markdoc contract", () => {
	assert.match(markdocConfig, /imageAlt:\s*\{\s*type:\s*String\s*\}/);
});

test("sidenote component styles stay out of global CSS", () => {
	assert.doesNotMatch(globalCss, /\.sidenote(?:-ref|-citation)?\b/);
	assert.match(articleProse, /\[counter-reset:sidenote\]/);
});

test("global CSS contains only reusable site primitives", () => {
	assert.doesNotMatch(
		globalCss,
		/navbar-blur|data-shell-content|article-prose|codeblock|vinyl-spin|scrollbar-hide|mono-1/,
	);
	assert.match(globalCss, /@theme\s*\{/);
	assert.match(globalCss, /@theme inline\s*\{/);
	assert.match(globalCss, /-webkit-font-smoothing:\s*antialiased/);
});
