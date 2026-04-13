import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { runDesignTokenCheck } from "../../scripts/check-design-tokens.mjs";

const execFileAsync = promisify(execFile);
const SCANNABLE_EXTENSIONS = new Set([
	".astro",
	".css",
	".js",
	".jsx",
	".mdoc",
	".ts",
	".tsx",
]);
const FINDING_LIMIT = 12;

function respond(payload) {
	process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	return chunks.join("");
}

async function git(args, cwd, { trim = true } = {}) {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return trim ? stdout.trim() : stdout;
}

function isScannable(relativePath) {
	return relativePath.startsWith("src/") && SCANNABLE_EXTENSIONS.has(path.extname(relativePath));
}

async function getChangedFiles(repoRoot) {
	const status = await git(["status", "--porcelain", "--untracked-files=all", "--", "src"], repoRoot, {
		trim: false,
	});

	return [
		...new Set(
			status
				.split("\n")
				.filter(Boolean)
				.map((line) => line.slice(3).trim())
				.map((filePath) => filePath.split(" -> ").at(-1))
				.filter(Boolean)
				.filter(isScannable),
		),
	].map((relativePath) => path.join(repoRoot, relativePath));
}

function summarizeFindings(report, repoRoot) {
	const lines = [];

	for (const result of report.results) {
		for (const issue of result.typographyIssues) {
			lines.push(`E ${path.relative(repoRoot, result.filePath)}:${issue.line} ${issue.match}`);
		}
	}

	return lines.slice(0, FINDING_LIMIT);
}

async function main() {
	const inputText = await readStdin();
	const payload = inputText ? JSON.parse(inputText) : {};

	if (payload.stop_hook_active) {
		respond({ continue: false });
		return;
	}

	const repoRoot = (await git(["rev-parse", "--show-toplevel"], process.cwd())) || process.cwd();
	const changedFiles = await getChangedFiles(repoRoot);

	if (changedFiles.length === 0) {
		respond({ continue: false });
		return;
	}

	const report = await runDesignTokenCheck({
		cwd: repoRoot,
		targets: changedFiles,
		themePath: path.join(repoRoot, "src/styles/global.css"),
	});

	if (report.typographyErrorCount === 0) {
		respond({ continue: false });
		return;
	}

	const summary = summarizeFindings(report, repoRoot);
	process.stderr.write(
		[
			`design-token-check: ${report.typographyErrorCount} typography error(s) in ${changedFiles.length} changed file(s)`,
			...summary,
			summary.length < report.typographyErrorCount
				? `… ${report.typographyErrorCount - summary.length} more finding(s)`
				: null,
		]
			.filter(Boolean)
			.join("\n") + "\n",
	);

	respond({
		decision: "block",
		reason: [
			`Design token check found ${report.typographyErrorCount} typography error(s) in changed files.`,
			"Do one cleanup pass now.",
			"Fix the typography errors.",
			"Do not start another self-triggered follow-up pass after this one.",
			"Findings:",
			...summary,
		].join("\n"),
	});
}

main().catch((error) => {
	process.stderr.write(`design-token-stop-hook failed: ${error instanceof Error ? error.message : String(error)}\n`);
	respond({ continue: false });
	process.exitCode = 0;
});
