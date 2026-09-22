import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { generateVinylSvg, getVinylBands, layoutVinylAlbum } from "../src/lib/vinylRecord.mjs";

const tracks = (minutes) =>
	minutes.map((duration, i) => ({
		id: i + 1,
		discNumber: 1,
		trackNumber: i + 1,
		durationMs: duration * 60_000,
	}));

test("balances the current EP and finds the selected song's side", () => {
	const album = tracks([252789, 257249, 336623, 326359, 286748].map((ms) => ms / 60000));
	const layout = layoutVinylAlbum(album, 1);
	assert.equal(layout.recordCount, 1);
	assert.equal(layout.selectedSide, 0);
	assert.deepEqual(
		layout.sides.map((side) => side.tracks.map((track) => track.id)),
		[
			[1, 2, 3],
			[4, 5],
		],
	);
	assert.equal(layoutVinylAlbum(album, 5).selectedSide, 1);
});

test("keeps short releases together and respects the 15-minute split threshold", () => {
	assert.equal(layoutVinylAlbum(tracks([5, 5, 5]), 1).sides.length, 1);
	assert.equal(layoutVinylAlbum(tracks([5, 5, 5.1]), 1).sides.length, 2);
	assert.equal(layoutVinylAlbum(tracks([20]), 1).sides.length, 1);
});

test("fits whole tracks, including albums that need more than two records", () => {
	for (const lengths of [
		[14, 14, 14],
		[10, 10, 10, 10, 10, 10, 10, 10],
		[21, 21, 21, 21, 21],
	]) {
		const album = tracks(lengths);
		const layout = layoutVinylAlbum(album, album.at(-1).id);
		assert.deepEqual(
			layout.sides.flatMap((side) => side.tracks),
			album,
		);
		assert.ok(layout.sides.every((side) => side.durationMs <= 22 * 60000));
		assert.equal(layout.recordCount, Math.ceil(layout.sides.length / 2));
	}
	assert.equal(layoutVinylAlbum(tracks([14, 14, 14]), 3).recordCount, 2);
	assert.equal(layoutVinylAlbum(tracks([21, 21, 21, 21, 21]), 5).recordCount, 3);
});

test("sorts digital discs and rejects missing or unusable metadata", () => {
	const album = tracks([4, 4, 4]);
	album[2].discNumber = 2;
	album[2].trackNumber = 1;
	assert.deepEqual(layoutVinylAlbum([...album].reverse(), 3).sides[0].tracks, album);
	assert.throws(() => layoutVinylAlbum(tracks([23]), 1), /22-minute/);
	assert.throws(() => layoutVinylAlbum(tracks([0]), 1), /positive durations/);
	assert.throws(() => layoutVinylAlbum(tracks([4]), 2), /missing/);
	assert.throws(() => layoutVinylAlbum([], 1), /no tracks/);
});

test("allocates radial width by duration with separate gaps and fixed endpoints", () => {
	const bands = getVinylBands(tracks([2, 4, 6]));
	const widths = bands.map((band) => band.outerRadius - band.innerRadius);
	assert.equal(widths[1], widths[0] * 2);
	assert.equal(widths[2], widths[0] * 3);
	assert.equal(bands[0].outerRadius, 328);
	assert.equal(bands.at(-1).innerRadius, 202);
	assert.equal(bands[0].innerRadius - bands[1].outerRadius, 3);
});

test("SVG is deterministic, escapes text, and renders reference geometry with transparency", async () => {
	const album = tracks([3, 5, 4]);
	const svg = generateVinylSvg(album, { title: '<unsafe & "title">' });
	assert.equal(svg, generateVinylSvg(album, { title: '<unsafe & "title">' }));
	assert.ok(svg.includes("&lt;unsafe &amp; &quot;title&quot;&gt;"));
	assert.ok(!svg.includes("<image"));
	const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
	assert.equal(info.width, 1024);
	const pixel = (x, y) => [
		...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4),
	];
	assert.equal(pixel(0, 0)[3], 0);
	assert.equal(pixel(512, 512)[3], 0);
	assert.equal(pixel(512, 130)[3], 0);
	assert.deepEqual(pixel(512, 142), [21, 21, 21, 255]);
	assert.deepEqual(pixel(512, 400), [255, 255, 255, 255]);
});
