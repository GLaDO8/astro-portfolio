import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({
	appType: "custom",
	logLevel: "silent",
	server: { middlewareMode: true },
});
after(() => server.close());
const { getSongData } = await server.ssrLoadModule("/src/lib/widgetConfig.ts");
const song = {
	trackId: 3,
	collectionId: 42,
	artistName: "Artist",
	trackName: "Selected song",
	collectionName: "Album",
	artworkUrl100: "https://example.com/100x100bb.jpg",
	previewUrl: "https://example.com/preview.m4a",
};
const album = [
	{ wrapperType: "collection", collectionId: 42, trackCount: 4 },
	...[1, 2, 3, 4].map((id) => ({
		kind: "song",
		collectionId: 42,
		trackId: id,
		discNumber: 1,
		trackNumber: id,
		trackTimeMillis: 8 * 60000,
	})),
];

test("build-time album lookup generates only the linked song's side", async (t) => {
	const requests = [];
	t.mock.method(globalThis, "fetch", async (url) => {
		requests.push(String(url));
		return Response.json({ results: requests.length === 1 ? [song] : album });
	});
	const data = await getSongData();
	assert.equal(requests.length, 2);
	assert.match(requests[1], /id=42&country=in&entity=song/);
	const svg = decodeURIComponent(data.vinylSrc.split(",").slice(1).join(","));
	assert.match(svg, /vinyl 1, side B/);
	assert.deepEqual(
		[...svg.matchAll(/data-track-id="(\d+)"/g)].map((match) => Number(match[1])),
		[3, 4],
	);
	assert.equal(data.previewUrl, song.previewUrl);
});

test("incomplete or failed album lookup preserves artwork and audio with static fallback", async (t) => {
	t.mock.method(console, "warn", () => {});
	for (const response of [
		Response.json({ results: album.slice(0, 3) }),
		new Response("Unavailable", { status: 503 }),
	]) {
		let calls = 0;
		const mock = t.mock.method(globalThis, "fetch", async () =>
			++calls === 1 ? Response.json({ results: [song] }) : response,
		);
		const data = await getSongData();
		assert.equal(data.vinylSrc, undefined);
		assert.equal(data.title, song.trackName);
		assert.equal(data.previewUrl, song.previewUrl);
		assert.equal(data.albumArt, "https://example.com/600x600bb.jpg");
		mock.mock.restore();
	}
});
