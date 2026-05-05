import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";

const accordionComponent = readFileSync("src/components/mdoc/Accordion.tsx", "utf8");

test("Markdown links in Markdoc open in a new tab", () => {
	const ast = Markdoc.parse("[Example](https://example.com)");
	const tree = Markdoc.transform(ast, markdocConfig);
	const html = Markdoc.renderers.html(tree);

	assert.match(html, /<a href="https:\/\/example\.com"/);
	assert.match(html, /target="_blank"/);
	assert.match(html, /rel="noopener noreferrer"/);
});

test("Accordion content keeps the article link affordance inside the not-prose island", () => {
	assert.match(accordionComponent, /not-prose/);

	for (const className of [
		"[&_a]:text-primary/70",
		"[&_a:hover]:text-primary",
		"[&_a]:underline",
		"[&_a]:decoration-dotted",
		"[&_a]:decoration-2",
		"[&_a]:underline-offset-3",
	]) {
		assert.ok(accordionComponent.includes(className), `Missing ${className}`);
	}
});
