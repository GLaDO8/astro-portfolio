import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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

const contentFiles = collectMdocFiles("src/content");

test("content uses Markdown image syntax instead of figure tags", () => {
	const offenders = [];

	for (const file of contentFiles) {
		const source = readFileSync(file, "utf8");

		if (/{%\s*figure\b/.test(source)) {
			offenders.push(file);
		}
	}

	assert.deepEqual(offenders, []);
});

test("Markdown image references are local and backed by an asset file", () => {
	const offenders = [];
	const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

	for (const file of contentFiles) {
		const source = readFileSync(file, "utf8");

		for (const match of source.matchAll(markdownImagePattern)) {
			const src = match[1];

			if (/^https?:\/\//.test(src)) {
				offenders.push(`${file}: external image ${src}`);
				continue;
			}

			if (!src.startsWith("/")) continue;

			const assetPath = join("src/assets", src);
			const publicPath = join("public", src);

			if (!existsSync(assetPath) && !existsSync(publicPath)) {
				offenders.push(`${file}: missing image asset ${src}`);
			}
		}
	}

	assert.deepEqual(offenders, []);
});
