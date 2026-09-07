import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { notesTypographyConfig, notesTypographyCss } from "../src/dev/notesTypography.ts";

function defaults(config) {
	return Object.fromEntries(
		Object.entries(config).map(([key, value]) => [
			key,
			Array.isArray(value)
				? value[0]
				: value && typeof value === "object" && !value.type
					? defaults(value)
					: value,
		]),
	);
}

test("live typography has no preview gate and responsive exports are scoped to notes", () => {
	const values = defaults(notesTypographyConfig);
	assert.equal("preview" in values, false);
	const panel = readFileSync(
		new URL("../src/dev/NotesTypographyPanel.tsx", import.meta.url),
		"utf8",
	);
	assert.match(panel, /<style>\{notesTypographyCss\(controller.values\)\}<\/style>/);
	assert.doesNotMatch(panel, /controller.values.preview/);
	const css = notesTypographyCss(values);
	assert.match(css, /\.notes-prose \{/);
	assert.match(css, /@media \(min-width: 48rem\)/);
	assert.match(css, /font-size: calc\(16 \/ 16 \* 1rem\)/);
	assert.match(css, /font-size: calc\(18 \/ 16 \* 1rem\)/);
	assert.match(css, /:not\(:where\(\.not-prose, \.not-prose \*\)\)/);
	assert.match(css, /\[data-notes-title\]/);
	for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6", "li", "strong", "a"]) {
		assert.ok(css.includes(`:where(${tag})`));
	}
});

test("CSS export reflects edited text, heading, list, and inline values", () => {
	const values = defaults(notesTypographyConfig);
	values.desktop.body.fontSizePx = 22;
	values.desktop.h2.fontWeight = 650;
	values.desktop.lists.itemSpacePx = 17;
	values.mobile.blockquote.italic = false;
	values.desktop.inline.codeSizePx = 19;
	const css = notesTypographyCss(values);
	assert.match(css, /font-size: calc\(22 \/ 16 \* 1rem\)/);
	assert.match(css, /font-weight: 650/);
	assert.match(css, /margin-block: 17px/);
	assert.match(css, /font-style: normal/);
	assert.match(css, /font-size: calc\(19 \/ 16 \* 1rem\)/);
});

test("panel is mounted behind the existing dev-only gate and only for note prose", () => {
	const document = readFileSync(new URL("../src/layouts/Document.astro", import.meta.url), "utf8");
	const tools = readFileSync(new URL("../src/dev/DevToolbars.tsx", import.meta.url), "utf8");
	assert.match(document, /isDev && <DevToolbars/);
	assert.match(tools, /document.querySelector\("\.notes-prose"\)/);
	assert.match(tools, /lazy\(\(\) => import\("@\/dev\/NotesTypographyPanel"\)\)/);
});
