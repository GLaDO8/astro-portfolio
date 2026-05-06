import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const snapsGallery = readFileSync("src/components/snaps/SnapsGallery.tsx", "utf8");

test("snaps gallery remaps vertical wheel input to horizontal scroll", () => {
	assert.match(snapsGallery, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
	assert.match(snapsGallery, /event\.preventDefault\(\);/);
	assert.match(snapsGallery, /gallery\.scrollLeft \+= delta;/);
});

test("snaps gallery only traps wheel scroll while horizontal movement is possible", () => {
	assert.match(snapsGallery, /scrollWidth - element\.clientWidth/);
	assert.match(snapsGallery, /maxScrollLeft - scrollEdgeTolerance/);
	assert.match(snapsGallery, /element\.scrollLeft > scrollEdgeTolerance/);
	assert.match(snapsGallery, /data-lenis-prevent=""/);
});
