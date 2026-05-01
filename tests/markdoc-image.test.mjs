import assert from "node:assert/strict";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";

const figureComponentPath = "./src/components/mdoc/Figure.astro";

test("standalone Markdown images render through the figure component", () => {
	const tree = Markdoc.transform(
		Markdoc.parse('![Flow diagram](/case-studies/example.webp "A caption")'),
		markdocConfig,
	);
	const [figure] = tree.children;

	assert.equal(figure.name.path, figureComponentPath);
	assert.deepEqual(figure.attributes, {
		src: "/case-studies/example.webp",
		alt: "Flow diagram",
		caption: "A caption",
		width: "wide",
	});
});

test("inline Markdown images stay inside their paragraph", () => {
	const tree = Markdoc.transform(
		Markdoc.parse("This keeps ![an icon](/icons/example.svg) inline."),
		markdocConfig,
	);
	const [paragraph] = tree.children;

	assert.equal(paragraph.name, "p");
	assert.equal(paragraph.children[1].name, "img");
	assert.equal(paragraph.children[1].attributes.src, "/icons/example.svg");
});
