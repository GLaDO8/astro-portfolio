import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const BIOME_EXTENSIONS = new Set([
	".astro",
	".css",
	".cjs",
	".js",
	".json",
	".jsonc",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);
const DESIGN_TOKEN_EXTENSIONS = new Set([".astro", ".css", ".js", ".jsx", ".mdoc", ".ts", ".tsx"]);
const IGNORED_PREFIXES = ["dist/", ".astro/", "node_modules/", ".codex/"];

function run(command, args) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, { stdio: "inherit" });

	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
		return false;
	}

	return true;
}

function readLines(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });

	if (result.status !== 0) {
		return [];
	}

	return result.stdout.split("\n").filter(Boolean);
}

function changedFiles() {
	const tracked = readLines("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD"]);
	const untracked = readLines("git", ["ls-files", "--others", "--exclude-standard"]);

	return [...new Set([...tracked, ...untracked])]
		.filter((filePath) => !IGNORED_PREFIXES.some((prefix) => filePath.startsWith(prefix)))
		.filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

function hasAny(files, predicate) {
	return files.some(predicate);
}

function matchingTests(files) {
	const tests = new Set();

	if (
		hasAny(
			files,
			(file) => file === "src/lib/navbar-active-path.js" || file === "src/components/Navbar.astro",
		)
	) {
		tests.add("tests/navbar-active-path.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "markdoc.config.ts" ||
				file.startsWith("src/content/") ||
				file.startsWith("src/components/mdoc/"),
		)
	) {
		tests.add("tests/markdoc-link.test.mjs");
		tests.add("tests/markdoc-image.test.mjs");
		tests.add("tests/markdoc-sidenote.test.mjs");
		tests.add("tests/content-images.test.mjs");
		tests.add("tests/content-grid-layout.test.mjs");
	}

	if (hasAny(files, (file) => file === "src/components/mdoc/Figure.astro")) {
		tests.add("tests/figure-component.test.mjs");
	}

	if (hasAny(files, (file) => file === "src/components/widgets/MusicWidget.tsx")) {
		tests.add("tests/music-widget-assets.test.mjs");
	}

	if (hasAny(files, (file) => file === "src/components/widgets/SnapsWidget.tsx")) {
		tests.add("tests/snaps-widget-motion.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) => file === "src/layouts/Document.astro" || file === "src/layouts/SnapsLayout.astro",
		)
	) {
		tests.add("tests/snaps-layout.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file.startsWith("src/dev/heroGoogleFontSwap") ||
				file === "src/dev/HeroGoogleFontSwapWidget.tsx",
		)
	) {
		tests.add("tests/hero-google-font-swap.test.mjs");
	}

	if (hasAny(files, (file) => file === "scripts/check-design-tokens.mjs")) {
		tests.add("tests/design-token-check.test.mjs");
	}

	if (hasAny(files, (file) => file === "scripts/optimize-images.mjs")) {
		tests.add("tests/optimize-images.test.mjs");
	}

	return [...tests].filter((file) => fs.existsSync(file));
}

const files = changedFiles();

if (files.length === 0) {
	console.log("verify:changed: no changed files.");
	process.exit(0);
}

console.log(`verify:changed: ${files.length} changed file(s).`);

const biomeFiles = files.filter((file) => BIOME_EXTENSIONS.has(path.extname(file)));
const designFiles = files.filter(
	(file) => file.startsWith("src/") && DESIGN_TOKEN_EXTENSIONS.has(path.extname(file)),
);
const tests = matchingTests(files);
let ok = true;

if (biomeFiles.length > 0) {
	ok = run("pnpm", ["exec", "biome", "check", ...biomeFiles]) && ok;
}

if (designFiles.length > 0) {
	ok = run("pnpm", ["exec", "node", "scripts/check-design-tokens.mjs", ...designFiles]) && ok;
}

if (tests.length > 0) {
	ok = run("pnpm", ["exec", "node", "--test", ...tests]) && ok;
} else {
	console.log("verify:changed: no focused tests matched these files.");
}

process.exitCode = ok ? 0 : process.exitCode || 1;
