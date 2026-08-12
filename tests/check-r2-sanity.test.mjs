import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const checker = ".codex/skills/check-r2-sanity/scripts/check-r2-sanity.mjs";

function sleepPayload(overrides = {}) {
	return {
		data: {
			metrics: [
				{
					name: "sleep_analysis",
					units: "hr",
					data: [
						{
							date: "2026-02-01 08:00:00 +0530",
							asleep: 7,
							awake: 0.5,
							core: 4,
							deep: 1,
							inBed: 8,
							rem: 2,
							totalSleep: 7,
							...overrides,
						},
					],
				},
			],
		},
	};
}

async function runChecker(payload) {
	const directory = await mkdtemp(join(tmpdir(), "health-sanity-test-"));

	try {
		await writeFile(join(directory, "export.json"), JSON.stringify(payload));
		const result = spawnSync(process.execPath, [checker, "--input-dir", directory], {
			cwd: process.cwd(),
			encoding: "utf8",
		});

		return { status: result.status, report: JSON.parse(result.stdout) };
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("accepts finite summarized sleep fields as valid numeric data", async () => {
	const { status, report } = await runChecker(sleepPayload());

	assert.equal(status, 0);
	assert.equal(report.metrics.invalidNumericRows, 0);
	assert.doesNotMatch(report.failures.join(","), /invalid_numeric_metric_rows/);
});

test("rejects malformed summarized sleep fields", async () => {
	const { status, report } = await runChecker(sleepPayload({ deep: "invalid" }));

	assert.equal(status, 1);
	assert.equal(report.metrics.invalidNumericRows, 1);
	assert.ok(report.failures.includes("invalid_numeric_metric_rows"));
});

test("rejects negative summarized sleep durations", async () => {
	const { status, report } = await runChecker(sleepPayload({ totalSleep: -1 }));

	assert.equal(status, 1);
	assert.equal(report.metrics.invalidNumericRows, 1);
	assert.ok(report.failures.includes("invalid_numeric_metric_rows"));
});

test("continues to reject malformed ordinary metric quantities", async () => {
	const { status, report } = await runChecker({
		data: {
			metrics: [
				{
					name: "step_count",
					units: "count",
					data: [{ date: "2026-02-01 08:00:00 +0530", qty: "invalid" }],
				},
			],
		},
	});

	assert.equal(status, 1);
	assert.equal(report.metrics.invalidNumericRows, 1);
	assert.ok(report.failures.includes("invalid_numeric_metric_rows"));
});
