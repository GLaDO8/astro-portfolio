#!/usr/bin/env node
import { watch } from "node:fs";
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = "public";
const SEARCH_DIRS = ["src"];
const SEARCH_ROOT_FILES = ["widget.toml"];
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
const WEBP_QUALITY = 95;

// Skip favicons, manifest icons, and Apple touch icons
const EXCLUDE = ["favicon", "apple-touch-icon", "web-app-manifest"];

async function* walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else yield path;
	}
}

function shouldProcess(filePath) {
	const name = basename(filePath).toLowerCase();
	return IMAGE_EXTS.has(extname(name)) && !EXCLUDE.some((pattern) => name.includes(pattern));
}

async function updateReferences(oldRef, newRef) {
	const files = [];

	for (const dir of SEARCH_DIRS) {
		for await (const file of walk(dir)) {
			const ext = extname(file);
			if ([".mdoc", ".astro", ".tsx", ".ts", ".jsx"].includes(ext)) {
				files.push(file);
			}
		}
	}

	for (const rootFile of SEARCH_ROOT_FILES) {
		try {
			await stat(rootFile);
			files.push(rootFile);
		} catch {}
	}

	for (const file of files) {
		const content = await readFile(file, "utf-8");
		if (content.includes(oldRef)) {
			await writeFile(file, content.replaceAll(oldRef, newRef));
			console.log(`  ↳ updated ${relative(".", file)}`);
		}
	}
}

async function optimizeImage(filePath) {
	const ext = extname(filePath);
	const webpPath = `${filePath.slice(0, -ext.length)}.webp`;
	const originalSize = (await stat(filePath)).size;

	await sharp(filePath).webp({ quality: WEBP_QUALITY }).toFile(webpPath);

	const newSize = (await stat(webpPath)).size;
	const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
	const sizeKB = (newSize / 1024).toFixed(1);

	const oldRef = `/${relative(PUBLIC_DIR, filePath)}`;
	const newRef = `/${relative(PUBLIC_DIR, webpPath)}`;
	await updateReferences(oldRef, newRef);
	await unlink(filePath);

	console.log(`✓ ${relative(".", filePath)} → .webp  ${sizeKB}KB  (${savings}% smaller)`);
}

async function processAll() {
	let count = 0;
	for await (const filePath of walk(PUBLIC_DIR)) {
		if (shouldProcess(filePath)) {
			await optimizeImage(filePath);
			count++;
		}
	}
	if (count === 0) console.log("No unoptimized images found.");
	else console.log(`\nOptimized ${count} image${count > 1 ? "s" : ""}.`);
}

function startWatch() {
	console.log(`Watching ${PUBLIC_DIR}/ for new images...\n`);
	const ac = new AbortController();

	watch(PUBLIC_DIR, { recursive: true, signal: ac.signal }, async (_event, filename) => {
		if (!filename) return;
		const filePath = join(PUBLIC_DIR, filename);
		try {
			await stat(filePath);
		} catch {
			return; // file was deleted
		}
		if (shouldProcess(filePath)) {
			// Small delay to let file writes finish
			setTimeout(() => optimizeImage(filePath).catch(console.error), 200);
		}
	});

	process.on("SIGINT", () => {
		ac.abort();
		process.exit(0);
	});
}

const isWatch = process.argv.includes("--watch");

await processAll();

if (isWatch) {
	startWatch();
}
