import assert from "node:assert/strict";
import test from "node:test";

import {
	healthDevIntegration,
	normalizeHealthQueryOutput,
} from "../src/dev/health/healthDevIntegration.mjs";

test("registers the health page and endpoint only for astro dev", () => {
	const integration = healthDevIntegration();
	const hook = integration.hooks["astro:config:setup"];
	const devRoutes = [];

	hook({
		command: "dev",
		injectRoute: (route) => devRoutes.push(route),
	});

	assert.equal(devRoutes.length, 1);
	assert.equal(devRoutes[0].pattern, "/health");

	for (const command of ["build", "preview", "sync"]) {
		const routes = [];
		hook({
			command,
			injectRoute: (route) => routes.push(route),
		});
		assert.deepEqual(routes, []);
	}
});

test("normalizes the selected D1 result sets without Wrangler metadata", () => {
	const payload = [
		{ results: [{ local_date: "2026-01-01", steps: 1234, active_energy_kj: 456 }] },
		{ results: [{ local_date: "2026-01-01", resting_heart_rate: 60, hrv: 45 }] },
		{ results: [{ local_date: "2026-01-01", total_sleep_hours: 7.5 }] },
		{ results: [{ local_date: "2026-01-01", value: 41.2 }] },
		{
			results: [
				{
					metric_code: "hba1c",
					collected_at_ms: 1,
					value: 5.4,
					unit: "%",
					qualifier: null,
				},
			],
		},
	];

	assert.deepEqual(normalizeHealthQueryOutput(payload), {
		activity: payload[0].results,
		recovery: payload[1].results,
		sleep: payload[2].results,
		vo2Max: payload[3].results,
		medical: payload[4].results,
	});
});

test("rejects incomplete D1 output", () => {
	assert.throws(() => normalizeHealthQueryOutput([{ results: [] }]), /five result sets/);
});
