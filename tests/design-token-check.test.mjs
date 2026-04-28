import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	extractThemeTokens,
	formatReport,
	runDesignTokenCheck,
} from "../scripts/check-design-tokens.mjs";

const THEME_CSS = `
@theme {
	--color-parchment: oklch(98.7% 0.002 197.1);
	--color-charcoal: #2a231d;
	--color-slate: #7a715f;
	--text-sm: clamp(0.8333rem, 0.8111rem + 0.0988vw, 0.9rem);
	--text-base: clamp(1rem, 0.9583rem + 0.1852vw, 1.125rem);
	--text-xl: clamp(1.44rem, 1.3341rem + 0.4708vw, 1.7578rem);
}
`;

async function withFixture(files, run) {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "design-token-check-"));

	try {
		for (const [relativePath, content] of Object.entries(files)) {
			const absolutePath = path.join(tmpDir, relativePath);
			await fs.mkdir(path.dirname(absolutePath), { recursive: true });
			await fs.writeFile(absolutePath, content);
		}

		await run(tmpDir);
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true });
	}
}

test("extractThemeTokens reads typography and color tokens from @theme", () => {
	const tokens = extractThemeTokens(THEME_CSS);

	assert.deepEqual([...tokens.textTokens].sort(), ["text-base", "text-sm", "text-xl"]);
	assert.deepEqual([...tokens.colorTokens].sort(), ["charcoal", "parchment", "slate"]);
});

test("runDesignTokenCheck fails on typography drift and warns on color drift", async () => {
	await withFixture(
		{
			"src/styles/global.css": THEME_CSS,
			"src/components/Example.astro": `
				<div class="text-[14px] bg-[#ffeedd] text-charcoal">Hello</div>
				<style>
					.card { font-size: 18px; color: #333f46; }
				</style>
			`,
		},
		async (tmpDir) => {
			const report = await runDesignTokenCheck({
				cwd: tmpDir,
				themePath: path.join(tmpDir, "src/styles/global.css"),
				targets: [path.join(tmpDir, "src")],
			});

			assert.equal(report.typographyErrorCount, 2);
			assert.equal(report.colorWarningCount, 2);

			const output = formatReport(report);
			assert.match(output, /ERROR .*text-\[14px\]/);
			assert.match(output, /ERROR .*font-size: 18px/);
			assert.match(output, /WARN {2}.*#ffeedd/);
			assert.match(output, /WARN {2}.*#333f46/);
		},
	);
});

test("runDesignTokenCheck allows token usage without findings", async () => {
	await withFixture(
		{
			"src/styles/global.css": THEME_CSS,
			"src/components/Okay.tsx": `
				export function Okay() {
					return <p className="text-base bg-parchment text-charcoal">Ready</p>;
				}
			`,
		},
		async (tmpDir) => {
			const report = await runDesignTokenCheck({
				cwd: tmpDir,
				themePath: path.join(tmpDir, "src/styles/global.css"),
				targets: [path.join(tmpDir, "src")],
			});

			assert.equal(report.typographyErrorCount, 0);
			assert.equal(report.colorWarningCount, 0);
			assert.equal(report.results.length, 0);
		},
	);
});
