import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("MusicWidget SSR emits browser-loadable preview icon URLs", async () => {
	const server = await createServer({
		appType: "custom",
		logLevel: "silent",
		root,
		server: {
			middlewareMode: true,
		},
		resolve: {
			alias: {
				"@": resolve(root, "src"),
			},
		},
	});
	after(() => server.close());

	const { default: MusicWidget } = await server.ssrLoadModule(
		"/src/components/widgets/MusicWidget.tsx",
	);

	const html = renderToStaticMarkup(
		React.createElement(MusicWidget, {
			songData: {
				artist: "Artist",
				title: "Track",
				album: "Album",
				albumArt: "/album.jpg",
				previewUrl: "/preview.m4a",
				trackUrl: "/track",
				message: "",
				label: "",
			},
		}),
	);

	assert.match(html, /aria-label="Play Track preview"/);
	assert.doesNotMatch(html, /src="file:\/\//);
});

test("MusicWidget omits the preview control when no preview is available", async () => {
	const server = await createServer({
		appType: "custom",
		logLevel: "silent",
		root,
		server: {
			middlewareMode: true,
		},
		resolve: {
			alias: {
				"@": resolve(root, "src"),
			},
		},
	});
	after(() => server.close());

	const { default: MusicWidget, getPreviewDisabledReason } = await server.ssrLoadModule(
		"/src/components/widgets/MusicWidget.tsx",
	);

	const html = renderToStaticMarkup(
		React.createElement(MusicWidget, {
			songData: {
				artist: "Artist",
				title: "Track",
				album: "Album",
				albumArt: "/album.jpg",
				previewUrl: "",
				trackUrl: "/track",
				message: "",
				label: "",
			},
		}),
	);

	assert.equal(
		getPreviewDisabledReason({ canPlayPreview: false, hasPlaybackError: false }),
		"missing-preview-url",
	);
	assert.equal(
		getPreviewDisabledReason({ canPlayPreview: true, hasPlaybackError: true }),
		"playback-error",
	);
	assert.doesNotMatch(html, /<button/);
	assert.doesNotMatch(html, /aria-label="Preview unavailable for Track"/);
});
