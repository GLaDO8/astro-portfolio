import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_THEME_PATH = path.join(REPO_ROOT, "src/styles/global.css");
const DEFAULT_SCAN_ROOT = path.join(REPO_ROOT, "src");
const SCANNABLE_EXTENSIONS = new Set([
	".astro",
	".css",
	".js",
	".jsx",
	".mdoc",
	".ts",
	".tsx",
]);

const TYPOGRAPHY_CLASS_RE = /\b(?:[\w-]+:)*text-\[([^\]]+)\]/g;
const COLOR_CLASS_RE =
	/\b(?:[\w-]+:)*(?:bg|text|border|fill|stroke|from|to|via|decoration|outline|ring)-\[([^\]]+)\]/g;
const CSS_FONT_SIZE_RE = /\bfont-size\s*:\s*([^;}\n]+)/g;
const JS_FONT_SIZE_RE = /[,{]\s*fontSize\s*:\s*([^,}\n]+)/g;
const CSS_COLOR_PROP_RE =
	/\b(?:color|background(?:-color)?|border(?:-color)?|outline-color|text-decoration-color|fill|stroke)\s*:\s*([^;}\n]+)/g;
const JS_COLOR_PROP_RE =
	/[,{]\s*(?:color|backgroundColor|borderColor|outlineColor|textDecorationColor|fill|stroke)\s*:\s*([^,}\n]+)/g;
const RAW_COLOR_RE =
	/(#[0-9a-fA-F]{3,8}\b|(?:oklch|oklab|rgb|rgba|hsl|hsla|color)\([^)\n]+\))/;
const TYPOGRAPHY_VALUE_RE =
	/^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vh|vw|ch|ex|lh|rlh)$/;

const TYPOGRAPHY_EXEMPT_PATTERNS = [/^var\(/, /^calc\(/];
const COLOR_LITERAL_ALLOWLIST = new Set([
	"transparent",
	"currentColor",
	"currentcolor",
	"inherit",
	"white",
	"black",
]);

function normalizeLiteral(value) {
	return value.trim().replace(/^["'`]/, "").replace(/["'`]$/, "").trim();
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractThemeTokens(cssText) {
	const textTokens = [];
	const colorTokens = [];

	for (const match of cssText.matchAll(/--text-([a-z0-9-]+)\s*:/g)) {
		textTokens.push(`text-${match[1]}`);
	}

	for (const match of cssText.matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
		colorTokens.push(match[1]);
	}

	return {
		textTokens: new Set(textTokens),
		colorTokens: new Set(colorTokens),
	};
}

function isTypographyLiteralAllowed(value) {
	const normalized = normalizeLiteral(value);
	return TYPOGRAPHY_EXEMPT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isColorLikeValue(value) {
	const normalized = normalizeLiteral(value);
	return (
		RAW_COLOR_RE.test(normalized) ||
		normalized.startsWith("var(") ||
		normalized.startsWith("theme(") ||
		COLOR_LITERAL_ALLOWLIST.has(normalized)
	);
}

function isTypographyLikeValue(value) {
	const normalized = normalizeLiteral(value);
	return (
		TYPOGRAPHY_VALUE_RE.test(normalized) ||
		normalized.startsWith("clamp(") ||
		normalized.startsWith("calc(") ||
		normalized.startsWith("var(")
	);
}

function isColorLiteralAllowed(value) {
	const normalized = normalizeLiteral(value);
	return (
		COLOR_LITERAL_ALLOWLIST.has(normalized) ||
		normalized.startsWith("var(") ||
		normalized.startsWith("currentColor") ||
		normalized.startsWith("theme(")
	);
}

function lineNumberAt(text, index) {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (text[i] === "\n") {
			line++;
		}
	}
	return line;
}

function pushMatch(matches, text, regex, kind, messageBuilder, shouldReport) {
	for (const match of text.matchAll(regex)) {
		const value = match[1]?.trim();
		if (!value || !shouldReport(value, match[0])) {
			continue;
		}

		matches.push({
			kind,
			line: lineNumberAt(text, match.index),
			match: match[0],
			value,
			message: messageBuilder(value, match[0]),
		});
	}
}

export function inspectFileContent(filePath, content, themeTokens) {
	const typographyIssues = [];
	const colorWarnings = [];

	pushMatch(
		typographyIssues,
		content,
		TYPOGRAPHY_CLASS_RE,
		"tailwind-class",
		(value) => `Avoid arbitrary typography token \`text-[${value}]\`. Use the Tailwind type scale from global theme tokens.`,
		(value) =>
			isTypographyLikeValue(value) &&
			!isColorLikeValue(value) &&
			!isTypographyLiteralAllowed(value),
	);

	pushMatch(
		typographyIssues,
		content,
		CSS_FONT_SIZE_RE,
		"css-font-size",
		(value) => `Avoid raw \`font-size: ${value}\`. Use the theme type scale or Tailwind text tokens.`,
		(value) => !isTypographyLiteralAllowed(value),
	);

	pushMatch(
		typographyIssues,
		content,
		JS_FONT_SIZE_RE,
		"js-font-size",
		(value) => `Avoid raw \`fontSize: ${value}\`. Use the theme type scale or Tailwind text tokens.`,
		(value) => !isTypographyLiteralAllowed(value),
	);

	pushMatch(
		colorWarnings,
		content,
		COLOR_CLASS_RE,
		"tailwind-color",
		(value) =>
			`Arbitrary color \`${value}\` bypasses theme color tokens (${Array.from(themeTokens.colorTokens)
				.map((token) => `text-${token}/bg-${token}`)
				.slice(0, 4)
				.join(", ")}...).`,
		(value) => isColorLikeValue(value) && !isColorLiteralAllowed(value),
	);

	pushMatch(
		colorWarnings,
		content,
		CSS_COLOR_PROP_RE,
		"css-color",
		(value) => `Raw color declaration \`${value}\` bypasses theme color tokens.`,
		(value, fullMatch) => RAW_COLOR_RE.test(fullMatch) && !isColorLiteralAllowed(value),
	);

	pushMatch(
		colorWarnings,
		content,
		JS_COLOR_PROP_RE,
		"js-color",
		(value) => `Raw color declaration \`${value}\` bypasses theme color tokens.`,
		(value, fullMatch) => RAW_COLOR_RE.test(fullMatch) && !isColorLiteralAllowed(value),
	);

	return {
		filePath,
		typographyIssues,
		colorWarnings,
	};
}

async function listFiles(targetPath) {
	const stats = await fs.stat(targetPath);
	if (stats.isFile()) {
		return SCANNABLE_EXTENSIONS.has(path.extname(targetPath)) ? [targetPath] : [];
	}

	const entries = await fs.readdir(targetPath, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(targetPath, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === ".astro" || entry.name === "dist") {
					return [];
				}
				return listFiles(entryPath);
			}
			return SCANNABLE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
		}),
	);

	return files.flat();
}

export async function runDesignTokenCheck({
	cwd = REPO_ROOT,
	themePath = DEFAULT_THEME_PATH,
	targets = [DEFAULT_SCAN_ROOT],
} = {}) {
	const themeCss = await fs.readFile(themePath, "utf8");
	const themeTokens = extractThemeTokens(themeCss);
	const resolvedTargets = targets.map((target) =>
		path.isAbsolute(target) ? target : path.resolve(cwd, target),
	);

	const fileLists = await Promise.all(resolvedTargets.map((target) => listFiles(target)));
	const files = [...new Set(fileLists.flat())].filter((filePath) => filePath !== themePath);

	const results = [];
	for (const filePath of files) {
		const content = await fs.readFile(filePath, "utf8");
		const result = inspectFileContent(filePath, content, themeTokens);
		if (result.typographyIssues.length > 0 || result.colorWarnings.length > 0) {
			results.push(result);
		}
	}

	return {
		themeTokens,
		results,
		typographyErrorCount: results.reduce(
			(total, result) => total + result.typographyIssues.length,
			0,
		),
		colorWarningCount: results.reduce(
			(total, result) => total + result.colorWarnings.length,
			0,
		),
	};
}

function formatLocation(filePath, line) {
	return `${path.relative(REPO_ROOT, filePath)}:${line}`;
}

export function formatReport(report) {
	const lines = [];

	for (const result of report.results) {
		for (const issue of result.typographyIssues) {
			lines.push(
				`ERROR ${formatLocation(result.filePath, issue.line)} ${issue.message}`,
			);
		}
		for (const warning of result.colorWarnings) {
			lines.push(
				`WARN  ${formatLocation(result.filePath, warning.line)} ${warning.message}`,
			);
		}
	}

	lines.push("");
	lines.push(
		`Design token check: ${report.typographyErrorCount} typography error(s), ${report.colorWarningCount} color warning(s).`,
	);

	return lines.join("\n");
}

async function main() {
	const targets = process.argv.slice(2);
	const report = await runDesignTokenCheck({
		targets: targets.length > 0 ? targets : undefined,
	});

	if (report.results.length > 0) {
		console.log(formatReport(report));
	} else {
		console.log("Design token check: 0 typography errors, 0 color warnings.");
	}

	process.exitCode = report.typographyErrorCount > 0 ? 1 : 0;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === url.fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
