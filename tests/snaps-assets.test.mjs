import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const snapsDirectory = "src/assets/snaps";
const snapsPage = readFileSync("src/pages/snaps.astro", "utf8");

test("all full-size snap assets are listed on the snaps page", () => {
	const fullSizeAssets = readdirSync(snapsDirectory, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => `/snaps/${entry.name}`)
		.sort();

	const listedAssets = Array.from(snapsPage.matchAll(/src:\s*"(?<src>\/snaps\/[^"]+)"/g), (match) =>
		path.posix.normalize(match.groups.src),
	).sort();

	assert.deepEqual(listedAssets, fullSizeAssets);
});
