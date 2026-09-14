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
const IGNORED_PREFIXES = ["dist/", ".astro/", "node_modules/", ".codex/", "public/lottie/"];
const GENERATED_FILES = new Set(["workers/health-ingest/worker-configuration.d.ts"]);

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
		.filter((filePath) => !GENERATED_FILES.has(filePath))
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
		tests.add("tests/markdoc-lottie.test.mjs");
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

	if (
		hasAny(
			files,
			(file) =>
				file === "src/lib/widgetConfig.ts" ||
				file === "src/components/widgets/BooksWidget.tsx" ||
				file === "tests/widget-config-books.test.mjs",
		)
	) {
		tests.add("tests/widget-config-books.test.mjs");
	}

	if (hasAny(files, (file) => file === "src/components/widgets/SnapsWidget.tsx")) {
		tests.add("tests/snaps-widget-motion.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "src/components/snaps/SnapsGallery.tsx" ||
				file === "tests/snaps-gallery-wheel.test.mjs",
		)
	) {
		tests.add("tests/snaps-gallery-wheel.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "src/pages/snaps.astro" ||
				file.startsWith("src/assets/snaps/") ||
				file === "tests/snaps-assets.test.mjs",
		)
	) {
		tests.add("tests/snaps-assets.test.mjs");
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

	if (
		hasAny(
			files,
			(file) =>
				file === "src/dev/devOverlayStyles.js" ||
				file === "src/dev/DevToolbars.tsx" ||
				file === "tests/dev-overlay-styles.test.mjs",
		)
	) {
		tests.add("tests/dev-overlay-styles.test.mjs");
	}

	if (hasAny(files, (file) => file === "scripts/check-design-tokens.mjs")) {
		tests.add("tests/design-token-check.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "astro.config.mjs" ||
				file.startsWith("src/components/health/") ||
				file.startsWith("src/dev/health/") ||
				file.startsWith("src/dev/pages/health.") ||
				file === "tests/health-dashboard-dev.test.mjs",
		)
	) {
		tests.add("tests/health-dashboard-dev.test.mjs");
	}

	if (hasAny(files, (file) => file === "scripts/optimize-images.mjs")) {
		tests.add("tests/optimize-images.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file.startsWith("scripts/health/") ||
				file.startsWith("tests/fixtures/health-auto-export/") ||
				file === "tests/health-auto-export-transform.test.mjs" ||
				file.startsWith("workers/health-ingest/migrations/health-auto-export/") ||
				file === "workers/health-ingest/wrangler.jsonc",
		)
	) {
		tests.add("tests/health-auto-export-transform.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "package.json" ||
				file === "scripts/verify-changed.mjs" ||
				file === "scripts/health/metric-definitions.mjs" ||
				file === "scripts/health/metric-rollups.mjs" ||
				file === "scripts/health/refresh-health-rollups.mjs" ||
				file === "scripts/health/import-health-auto-export.mjs" ||
				file === "scripts/health/bootstrap-local-d1.mjs" ||
				file === "src/dev/health/healthDevIntegration.mjs" ||
				file === "tests/health-rollups.test.mjs" ||
				file === "workers/health-ingest/migrations/health-auto-export/0003_metric_rollups.sql" ||
				file === "workers/health-ingest/README.md" ||
				file === "workers/health-ingest/migrations/README.md" ||
				file === "plans/health-materialized-rollups.md",
		)
	) {
		tests.add("tests/health-rollups.test.mjs");
		tests.add("tests/health-d1-local.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "scripts/health/d1-runner.mjs" ||
				file === "scripts/health/migrate-health-d1.mjs" ||
				file === "tests/health-d1-runner.test.mjs",
		)
	) {
		tests.add("tests/health-d1-runner.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "package.json" ||
				file === "scripts/verify-changed.mjs" ||
				file === "scripts/health/d1-runner.mjs" ||
				file === "scripts/health/bootstrap-local-d1.mjs" ||
				file === "scripts/health/import-health-auto-export.mjs" ||
				file === "scripts/health/migrate-health-d1.mjs" ||
				file === "src/dev/health/healthDevIntegration.mjs" ||
				file === "tests/health-d1-local.test.mjs" ||
				file === "workers/health-ingest/README.md" ||
				file === "workers/health-ingest/migrations/README.md" ||
				file === "workers/health-ingest/migrations/0001_medical_metrics.sql" ||
				file.startsWith("workers/health-ingest/migrations/health-auto-export/") ||
				file === "workers/health-ingest/wrangler.jsonc" ||
				file === "plans/local-d1-first-migration.md" ||
				file === "plans/local-health-dashboard.md" ||
				file.startsWith("tests/fixtures/health-auto-export/"),
		)
	) {
		tests.add("tests/health-d1-local.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "scripts/health/clone-remote-d1-to-local.mjs" ||
				file === "tests/health-d1-clone.test.mjs",
		)
	) {
		tests.add("tests/health-d1-clone.test.mjs");
	}

	if (
		hasAny(
			files,
			(file) =>
				file === "package.json" ||
				file === "scripts/health/sync-medical-metrics-to-local.mjs" ||
				file === "tests/health-medical-local-sync.test.mjs" ||
				file === "workers/health-ingest/README.md",
		)
	) {
		tests.add("tests/health-medical-local-sync.test.mjs");
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
const healthWorkerChanged = hasAny(
	files,
	(file) =>
		file.startsWith("workers/health-ingest/") ||
		file === "package.json" ||
		file === "pnpm-lock.yaml",
);
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

if (healthWorkerChanged) {
	ok = run("pnpm", ["health:verify"]) && ok;
}

process.exitCode = ok ? 0 : process.exitCode || 1;
