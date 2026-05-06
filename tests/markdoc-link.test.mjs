import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";
import { articleProseClass } from "../src/lib/articleProse.ts";

const accordionComponent = readFileSync("src/components/mdoc/Accordion.tsx", "utf8");

test("Markdown links in Markdoc open in a new tab", () => {
	const ast = Markdoc.parse("[Example](https://example.com)");
	const tree = Markdoc.transform(ast, markdocConfig);
	const html = Markdoc.renderers.html(tree);

	assert.match(html, /<a href="https:\/\/example\.com"/);
	assert.match(html, /target="_blank"/);
	assert.match(html, /rel="noopener noreferrer"/);
});

test("Accordion chrome stays out of prose while content keeps article link styling", () => {
	assert.match(accordionComponent, /not-prose/);
	assert.match(accordionComponent, /articleProseClass/);

	for (const className of [
		"prose-a:text-primary/70",
		"prose-a:hover:text-primary",
		"prose-a:decoration-dotted",
		"prose-a:decoration-2",
		"prose-a:underline-offset-3",
	]) {
		assert.ok(articleProseClass.includes(className), `Missing ${className}`);
	}
});

test("Accordion content uses the shared article Markdown styling", () => {
	assert.match(accordionComponent, /articleProseClass/);

	for (const className of [
		"prose",
		"md:prose-lg",
		"prose-li:marker:text-primary",
		"prose-code:bg-zinc-50",
		"prose-code:border-zinc-300",
		"prose-code:rounded",
		"prose-headings:font-sans",
	]) {
		assert.ok(articleProseClass.includes(className), `Missing ${className}`);
	}
});
