#!/usr/bin/env node
import { watch } from "node:fs";
import { readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export const IMAGE_ROOTS = [
	{
		dir: "public",
		refBase: "",
	},
	{
		dir: "src/assets",
		refBase: "",
		aliasBase: "@/assets",
	},
];
export const SEARCH_DIRS = ["src"];
export const SEARCH_ROOT_FILES = ["widget.toml"];
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
const WEBP_QUALITY = 95;

// Skip favicons, manifest icons, and Apple touch icons
const EXCLUDE = ["favicon", "apple-touch-icon", "web-app-manifest"];

async function* walk(dir) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (error) {
		if (error?.code === "ENOENT") return;
		throw error;
	}

	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else yield path;
	}
}

export function shouldProcess(filePath) {
	const name = basename(filePath).toLowerCase();
	return IMAGE_EXTS.has(extname(name)) && !EXCLUDE.some((pattern) => name.includes(pattern));
}

function toPosixPath(path) {
	return path.split(sep).join("/");
}

function isInsideDir(dir, filePath) {
	const pathFromDir = relative(dir, filePath);

	return pathFromDir && !pathFromDir.startsWith("..") && !isAbsolute(pathFromDir);
}

export function getImageRoot(filePath) {
	return IMAGE_ROOTS.find(({ dir }) => isInsideDir(dir, filePath));
}

function getRelativeSourceRef(fromFile, targetFile) {
	let ref = toPosixPath(relative(dirname(fromFile), targetFile));

	if (!ref.startsWith(".")) {
		ref = `./${ref}`;
	}

	return ref;
}

export function getReferencePairs(file, oldPath, newPath, imageRoot) {
	const oldRootRef = `/${toPosixPath(join(imageRoot.refBase, relative(imageRoot.dir, oldPath)))}`;
	const newRootRef = `/${toPosixPath(join(imageRoot.refBase, relative(imageRoot.dir, newPath)))}`;
	const pairs = [[oldRootRef, newRootRef]];

	if (imageRoot.aliasBase) {
		const oldAliasRef = `${imageRoot.aliasBase}/${toPosixPath(relative(imageRoot.dir, oldPath))}`;
		const newAliasRef = `${imageRoot.aliasBase}/${toPosixPath(relative(imageRoot.dir, newPath))}`;
		pairs.push([oldAliasRef, newAliasRef]);
	}

	pairs.push([getRelativeSourceRef(file, oldPath), getRelativeSourceRef(file, newPath)]);

	return pairs;
}

async function getFileSize(filePath) {
	try {
		return (await stat(filePath)).size;
	} catch (error) {
		if (error?.code === "ENOENT") return undefined;
		throw error;
	}
}

export async function updateReferences(oldPath, newPath, imageRoot) {
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
		let updatedContent = content;

		for (const [oldRef, newRef] of getReferencePairs(file, oldPath, newPath, imageRoot)) {
			updatedContent = updatedContent.replaceAll(oldRef, newRef);
		}

		if (updatedContent !== content) {
			await writeFile(file, updatedContent);
			console.log(`  ↳ updated ${relative(".", file)}`);
		}
	}
}

export async function optimizeImage(filePath) {
	const imageRoot = getImageRoot(filePath);

	if (!imageRoot) {
		throw new Error(`No image root configured for ${filePath}`);
	}

	const ext = extname(filePath);
	const webpPath = `${filePath.slice(0, -ext.length)}.webp`;
	const originalSize = (await stat(filePath)).size;
	const tempWebpPath = `${webpPath}.${process.pid}.tmp`;

	await sharp(filePath).webp({ quality: WEBP_QUALITY }).toFile(tempWebpPath);

	const generatedSize = (await stat(tempWebpPath)).size;
	const existingWebpSize = await getFileSize(webpPath);
	const shouldReuseExistingWebp =
		existingWebpSize !== undefined && existingWebpSize <= generatedSize;
	const newSize = shouldReuseExistingWebp ? existingWebpSize : generatedSize;

	if (newSize >= originalSize) {
		await unlink(tempWebpPath);
		const sizeKB = (originalSize / 1024).toFixed(1);
		const webpSizeKB = (newSize / 1024).toFixed(1);
		console.log(`↷ skipped ${relative(".", filePath)}  original ${sizeKB}KB, webp ${webpSizeKB}KB`);
		return false;
	}

	if (shouldReuseExistingWebp) {
		await unlink(tempWebpPath);
	} else {
		await rename(tempWebpPath, webpPath);
	}

	const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
	const sizeKB = (newSize / 1024).toFixed(1);

	await updateReferences(filePath, webpPath, imageRoot);
	await unlink(filePath);

	console.log(`✓ ${relative(".", filePath)} → .webp  ${sizeKB}KB  (${savings}% smaller)`);
	return true;
}

export async function processAll() {
	let count = 0;

	for (const { dir } of IMAGE_ROOTS) {
		for await (const filePath of walk(dir)) {
			if (shouldProcess(filePath)) {
				const optimized = await optimizeImage(filePath);
				if (optimized) count++;
			}
		}
	}

	if (count === 0) console.log("No images optimized.");
	else console.log(`\nOptimized ${count} image${count > 1 ? "s" : ""}.`);
}

export function startWatch() {
	console.log(`Watching ${IMAGE_ROOTS.map(({ dir }) => `${dir}/`).join(", ")} for new images...\n`);
	const ac = new AbortController();

	for (const { dir } of IMAGE_ROOTS) {
		watch(dir, { recursive: true, signal: ac.signal }, async (_event, filename) => {
			if (!filename) return;
			const filePath = join(dir, filename);
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
	}

	process.on("SIGINT", () => {
		ac.abort();
		process.exit(0);
	});
}

function isMainModule() {
	return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
	const isWatch = process.argv.includes("--watch");

	await processAll();

	if (isWatch) {
		startWatch();
	}
}
