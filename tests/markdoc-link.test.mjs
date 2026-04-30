import assert from "node:assert/strict";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";

test("Markdown links in Markdoc open in a new tab", () => {
	const ast = Markdoc.parse("[Example](https://example.com)");
	const tree = Markdoc.transform(ast, markdocConfig);
	const html = Markdoc.renderers.html(tree);

	assert.match(html, /<a href="https:\/\/example\.com"/);
	assert.match(html, /target="_blank"/);
	assert.match(html, /rel="noopener noreferrer"/);
});
