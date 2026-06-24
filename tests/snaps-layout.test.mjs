import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const documentLayout = readFileSync("src/layouts/Document.astro", "utf8");
const snapsLayout = readFileSync("src/layouts/SnapsLayout.astro", "utf8");
const snapsPage = readFileSync("src/pages/snaps.astro", "utf8");
const snapsGallery = readFileSync("src/components/snaps/SnapsGallery.tsx", "utf8");

test("Document constrains the shared shell by default but allows opt-out layouts", () => {
	assert.match(documentLayout, /constrainShell\s*=\s*true/);
	assert.match(documentLayout, /constrainShell\s*&&\s*"max-w-7xl"/);
});

test("SnapsLayout uses a full-bleed shell for the horizontal photo roll", () => {
	assert.match(snapsLayout, /constrainShell=\{false\}/);
	assert.match(snapsLayout, /"px-0 min-h-0 overflow-hidden pb-0"/);
	assert.doesNotMatch(snapsLayout, /sm:px-5/);
});

test("snaps page gives the gallery a viewport-derived image height budget", () => {
	assert.match(snapsPage, /data-snaps-page/);
	assert.match(snapsPage, /--snaps-image-max-height:max\(8rem,calc\(100dvh-18rem\)\)/);
	assert.match(snapsPage, /lg:\[--snaps-image-max-height:max\(12rem,calc\(100dvh-25\.5rem\)\)\]/);
	assert.match(snapsPage, /class="min-h-0 flex-1"/);
});

test("snaps gallery caps image heights to the page height budget", () => {
	assert.match(snapsGallery, /h-full/);
	assert.match(snapsGallery, /var\(--snaps-image-max-height\)/);
	assert.doesNotMatch(snapsGallery, /lg:h-(180|144|96)/);
});

test("snaps gallery reserves extra bottom padding on short viewports", () => {
	assert.match(snapsGallery, /\[@media\(max-height:860px\)\]:pt-3/);
	assert.match(snapsGallery, /\[@media\(max-height:860px\)\]:pb-9/);
	assert.match(snapsPage, /@media \(min-width: 64rem\) and \(max-height: 860px\)/);
	assert.match(snapsPage, /calc\(100dvh - 27\.5rem\)/);
});
