import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";

const sidenoteComponentPath = "./src/components/mdoc/Sidenote.astro";

function collectMdocFiles(directory) {
	const entries = readdirSync(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...collectMdocFiles(path));
		} else if (entry.isFile() && entry.name.endsWith(".mdoc")) {
			files.push(path);
		}
	}

	return files;
}

test("block sidenotes with blank lines keep all paragraphs inside the component", () => {
	const source = `{% sidenote %}
First paragraph.

Second paragraph.
{% /sidenote %}`;

	const tree = Markdoc.transform(Markdoc.parse(source), markdocConfig);
	const [sidenote] = tree.children;

	assert.equal(sidenote.name.path, sidenoteComponentPath);
	assert.deepEqual(
		sidenote.children.map((child) => child.name),
		["p", "p"],
	);
});

test("multiline sidenotes in content use block tag syntax", () => {
	const offenders = [];
	const sidenoteOpeningPattern = /{%\s*sidenote\b[^%]*%}(.*)$/;

	for (const file of collectMdocFiles("src/content")) {
		const source = readFileSync(file, "utf8");

		source.split("\n").forEach((line, index) => {
			const match = line.match(sidenoteOpeningPattern);
			const contentAfterOpeningTag = match?.[1]?.trim();

			if (contentAfterOpeningTag && !contentAfterOpeningTag.includes("{% /sidenote %}")) {
				offenders.push(`${file}:${index + 1}: move the sidenote opening marker to its own line`);
			}
		});
	}

	assert.deepEqual(offenders, []);
});
