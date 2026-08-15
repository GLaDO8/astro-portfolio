import { resolveD1Target, runD1 } from "../../../scripts/health/d1-runner.mjs";
import { METRIC_AGGREGATION_VERSION } from "../../../scripts/health/metric-definitions.mjs";

export const HEALTH_STATE_QUERY = `
SELECT aggregation_version, status, data_revision, first_local_date, last_local_date,
  (SELECT MIN(local_date) FROM sleep_summaries) AS first_sleep_date,
  (SELECT MAX(local_date) FROM sleep_summaries) AS last_sleep_date
FROM metric_rollup_state WHERE singleton = 1;
`;

export const HEALTH_QUERY = `
SELECT mr.period_start AS local_date,
  MAX(CASE WHEN md.code = 'step_count' THEN mr.value_sum END) AS steps,
  MAX(CASE WHEN md.code = 'active_energy' THEN mr.value_sum END) AS active_energy_kj,
  MAX(CASE WHEN md.code = 'apple_exercise_time' THEN mr.value_sum END) AS exercise_minutes
FROM metric_rollups mr JOIN metric_definitions md ON md.id = mr.metric_id
JOIN metric_rollup_state state ON state.singleton = 1
WHERE mr.grain = 'week'
  AND md.code IN ('step_count', 'active_energy', 'apple_exercise_time')
  AND mr.period_start >= date(state.first_local_date, '+' || ((8 - CAST(strftime('%w', state.first_local_date) AS INTEGER)) % 7) || ' days')
  AND mr.period_start <= date(state.last_local_date, '-6 days')
GROUP BY mr.period_start ORDER BY mr.period_start;

SELECT mr.period_start AS local_date,
  MAX(CASE WHEN md.code = 'resting_heart_rate' THEN mr.value_sum / mr.sample_count END) AS resting_heart_rate,
  MAX(CASE WHEN md.code = 'heart_rate_variability' THEN mr.value_sum / mr.sample_count END) AS hrv
FROM metric_rollups mr JOIN metric_definitions md ON md.id = mr.metric_id
JOIN metric_rollup_state state ON state.singleton = 1
WHERE mr.grain = 'week'
  AND md.code IN ('resting_heart_rate', 'heart_rate_variability')
  AND mr.period_start >= date(state.first_local_date, '+' || ((8 - CAST(strftime('%w', state.first_local_date) AS INTEGER)) % 7) || ' days')
  AND mr.period_start <= date(state.last_local_date, '-6 days')
GROUP BY mr.period_start ORDER BY mr.period_start;

SELECT local_date, total_sleep_hours, awake_hours, core_hours, deep_hours, rem_hours
FROM sleep_summaries ORDER BY local_date;

SELECT mr.period_start AS local_date, mr.latest_value AS value
FROM metric_rollups mr
WHERE mr.metric_id = (SELECT id FROM metric_definitions WHERE code = 'vo2_max')
  AND mr.grain = 'day'
ORDER BY mr.period_start;

SELECT metric_code, collected_at_ms, value, unit, qualifier
FROM medical_metrics
WHERE metric_code IN (
  'hba1c',
  'vitamin_d_25_oh',
  'cholesterol_total',
  'cholesterol_hdl',
  'cholesterol_ldl_calculated',
  'cholesterol_vldl_calculated',
  'cholesterol_non_hdl',
  'triglycerides',
  'rbc_count',
	'hemoglobin',
	'hematocrit',
	'mcv',
	'mch',
	'mchc',
	'rdw_cv',
	'wbc_count',
	'neutrophils_percent',
	'lymphocytes_percent',
	'monocytes_percent',
	'eosinophils_percent',
	'basophils_percent',
	'absolute_neutrophil_count',
	'absolute_lymphocyte_count',
	'absolute_monocyte_count',
	'absolute_eosinophil_count',
	'absolute_basophil_count',
	'platelet_count',
	'mean_platelet_volume',
	'alt',
	'ast',
	'alkaline_phosphatase',
	'ggt',
	'bilirubin_total',
	'bilirubin_direct',
	'bilirubin_indirect',
	'albumin',
	'globulin',
	'protein_total',
	'creatinine_serum',
	'egfr',
	'bun',
	'urea',
	'uric_acid',
  'sodium',
  'potassium',
	'chloride',
	'calcium',
	'phosphorus',
	'tsh',
	't3_total',
	't4_total',
	'iron_serum',
	'tibc',
	'uibc',
	'transferrin_saturation',
	'vitamin_b12'
)
ORDER BY collected_at_ms, metric_code;

SELECT mr.period_start AS local_date, mr.latest_value AS value
FROM metric_rollups mr
WHERE mr.metric_id = (SELECT id FROM metric_definitions WHERE code = 'weight_body_mass')
  AND mr.grain = 'day'
ORDER BY mr.period_start;

WITH ranked AS (
  SELECT md.code, mr.period_start AS local_date,
    CASE md.rollup_method
      WHEN 'sum' THEN mr.value_sum
      WHEN 'average' THEN mr.value_sum / mr.sample_count
      WHEN 'range' THEN mr.value_sum / mr.sample_count
      WHEN 'latest' THEN mr.latest_value
    END AS value,
    ROW_NUMBER() OVER (PARTITION BY md.code ORDER BY mr.period_start DESC) AS recency
  FROM metric_rollups mr JOIN metric_definitions md ON md.id = mr.metric_id
  WHERE mr.grain = 'day' AND md.code IN ('step_count', 'resting_heart_rate')
)
SELECT code, local_date, value FROM ranked WHERE recency = 1 ORDER BY code;
`;

function coverageDate(...dates) {
	return dates.filter((date) => typeof date === "string").sort()[0] ?? null;
}

function lastCoverageDate(...dates) {
	return (
		dates
			.filter((date) => typeof date === "string")
			.sort()
			.at(-1) ?? null
	);
}

export function normalizeHealthQueryOutput(payload, state) {
	if (!Array.isArray(payload) || payload.length !== 7) {
		throw new Error("Expected seven result sets from D1.");
	}

	const resultSets = payload.map((item) => {
		if (!item || !Array.isArray(item.results)) {
			throw new Error("D1 returned an invalid result set.");
		}
		return item.results;
	});

	const summaries = Object.fromEntries(
		resultSets[6].map(({ code, local_date, value }) => [code, { local_date, value }]),
	);
	return {
		activity: resultSets[0],
		recovery: resultSets[1],
		sleep: resultSets[2],
		vo2Max: resultSets[3],
		medical: resultSets[4],
		weight: resultSets[5],
		summaries,
		coverage: {
			firstDate: coverageDate(state.first_local_date, state.first_sleep_date),
			lastDate: lastCoverageDate(state.last_local_date, state.last_sleep_date),
		},
		aggregation: {
			version: Number(state.aggregation_version),
			grains: {
				activity: "week",
				recovery: "week",
				vo2Max: "day",
				weight: "day",
				summaries: "day",
			},
		},
	};
}

export function resolveDashboardTarget(env = process.env) {
	const requestedMode = env.HEALTH_DASHBOARD_D1_TARGET;
	if (requestedMode === undefined || requestedMode === "local") {
		if (env.HEALTH_DASHBOARD_REMOTE_CONFIRM) throw new Error("dashboard_target_invalid");
		return resolveD1Target({ mode: "local" });
	}
	throw new Error("dashboard_target_invalid");
}

export function assertReadOnlyHealthQuery(sql) {
	const statements = sql
		.split(";")
		.map((statement) => statement.trim())
		.filter(Boolean);
	const writePattern =
		/\b(ALTER|ATTACH|CREATE|DELETE|DETACH|DROP|INSERT|PRAGMA|REINDEX|REPLACE|UPDATE|VACUUM)\b/i;
	if (
		statements.length === 0 ||
		statements.some(
			(statement) => !/^(SELECT|WITH)\b/i.test(statement) || writePattern.test(statement),
		)
	) {
		throw new Error("health_query_not_read_only");
	}
}

export async function queryHealthData(target, execute = runD1) {
	assertReadOnlyHealthQuery(HEALTH_STATE_QUERY);
	assertReadOnlyHealthQuery(HEALTH_QUERY);
	const payload = await execute({
		command: `${HEALTH_STATE_QUERY}\n${HEALTH_QUERY}`,
		target,
		json: true,
	});
	const state = payload?.[0]?.results?.[0];
	if (
		state?.status !== "ready" ||
		Number(state?.aggregation_version) !== METRIC_AGGREGATION_VERSION
	) {
		throw new Error("health_rollup_backfill_required");
	}
	return normalizeHealthQueryOutput(payload.slice(1), state);
}

export function healthDataPlugin({
	env = process.env,
	queryHealthData: query = queryHealthData,
	log = console.info,
} = {}) {
	const target = resolveDashboardTarget(env);
	let dataPromise;

	return {
		name: "health-dashboard-dev-data",
		apply: "serve",
		configureServer(server) {
			log(`[health dashboard] D1 target: ${target.mode}`);
			server.middlewares.use("/__dev/health-data", async (request, response) => {
				if (request.method !== "GET") {
					response.statusCode = 405;
					response.setHeader("Allow", "GET");
					response.end();
					return;
				}

				try {
					let requestPromise;
					if (target.mode === "remote") {
						dataPromise ??= query(target);
						requestPromise = dataPromise;
					} else {
						requestPromise = query(target);
					}
					const data = await requestPromise;
					response.statusCode = 200;
					response.setHeader("Cache-Control", "no-store");
					response.setHeader("Content-Type", "application/json; charset=utf-8");
					response.end(JSON.stringify(data));
				} catch (error) {
					if (target.mode === "remote") dataPromise = undefined;
					const backfillRequired = error?.message === "health_rollup_backfill_required";
					response.statusCode = backfillRequired ? 503 : 500;
					response.setHeader("Cache-Control", "no-store");
					response.setHeader("Content-Type", "application/json; charset=utf-8");
					response.end(
						JSON.stringify(
							backfillRequired
								? {
										error: "health_rollup_backfill_required",
										action: "pnpm health:rollups:backfill:local",
									}
								: { error: "health_database_unavailable", source: target.mode },
						),
					);
				}
			});
		},
	};
}

export function healthDevIntegration() {
	return {
		name: "health-dashboard-dev",
		hooks: {
			"astro:config:setup": ({ command, injectRoute }) => {
				if (command !== "dev") {
					return;
				}

				injectRoute({
					pattern: "/health",
					entrypoint: new URL("../pages/health.astro", import.meta.url),
				});
			},
		},
	};
}
