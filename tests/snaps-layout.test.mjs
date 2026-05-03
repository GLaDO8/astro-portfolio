import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const documentLayout = readFileSync("src/layouts/Document.astro", "utf8");
const snapsLayout = readFileSync("src/layouts/SnapsLayout.astro", "utf8");

test("Document constrains the shared shell by default but allows opt-out layouts", () => {
	assert.match(documentLayout, /constrainShell\s*=\s*true/);
	assert.match(documentLayout, /constrainShell\s*&&\s*"max-w-7xl"/);
});

test("SnapsLayout uses a full-bleed shell for the horizontal photo roll", () => {
	assert.match(snapsLayout, /constrainShell=\{false\}/);
	assert.match(snapsLayout, /"px-0 pb-20"/);
	assert.doesNotMatch(snapsLayout, /sm:px-5/);
});
