import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../../../", import.meta.url);
const wranglerPath = new URL("node_modules/.bin/wrangler", projectRoot);
const wranglerConfig = new URL("workers/health-ingest/wrangler.jsonc", projectRoot);

export const HEALTH_QUERY = `
WITH RECURSIVE bounds AS (
  SELECT MIN(local_date) AS first_date, MAX(local_date) AS last_date FROM metric_samples
), dates(local_date) AS (
  SELECT first_date FROM bounds
  UNION ALL
  SELECT date(local_date, '+1 day') FROM dates, bounds WHERE local_date < last_date
), daily AS (
  SELECT ms.local_date,
    SUM(CASE WHEN md.code = 'step_count' THEN ms.value END) AS steps,
    SUM(CASE WHEN md.code = 'active_energy' THEN ms.value END) AS active_energy_kj,
    SUM(CASE WHEN md.code = 'apple_exercise_time' THEN ms.value END) AS exercise_minutes
  FROM metric_samples ms JOIN metric_definitions md ON md.id = ms.metric_id
  WHERE md.code IN ('step_count', 'active_energy', 'apple_exercise_time')
  GROUP BY ms.local_date
)
SELECT dates.local_date, daily.steps, daily.active_energy_kj, daily.exercise_minutes
FROM dates LEFT JOIN daily USING (local_date) ORDER BY dates.local_date;

WITH RECURSIVE bounds AS (
  SELECT MIN(local_date) AS first_date, MAX(local_date) AS last_date FROM metric_samples
), dates(local_date) AS (
  SELECT first_date FROM bounds
  UNION ALL
  SELECT date(local_date, '+1 day') FROM dates, bounds WHERE local_date < last_date
), daily AS (
  SELECT ms.local_date,
    AVG(CASE WHEN md.code = 'resting_heart_rate' THEN ms.value END) AS resting_heart_rate,
    AVG(CASE WHEN md.code = 'heart_rate_variability' THEN ms.value END) AS hrv
  FROM metric_samples ms JOIN metric_definitions md ON md.id = ms.metric_id
  WHERE md.code IN ('resting_heart_rate', 'heart_rate_variability')
  GROUP BY ms.local_date
)
SELECT dates.local_date, daily.resting_heart_rate, daily.hrv
FROM dates LEFT JOIN daily USING (local_date) ORDER BY dates.local_date;

SELECT local_date, total_sleep_hours, awake_hours, core_hours, deep_hours, rem_hours
FROM sleep_summaries ORDER BY local_date;

SELECT ms.local_date, ms.value
FROM metric_samples ms JOIN metric_definitions md ON md.id = ms.metric_id
WHERE md.code = 'vo2_max' ORDER BY ms.observed_at_ms;

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

WITH ranked_weight AS (
  SELECT ms.local_date, ms.value,
    ROW_NUMBER() OVER (
      PARTITION BY ms.local_date ORDER BY ms.observed_at_ms DESC, ms.id DESC
    ) AS recency
  FROM metric_samples ms JOIN metric_definitions md ON md.id = ms.metric_id
  WHERE md.code = 'weight_body_mass'
)
SELECT local_date, value FROM ranked_weight WHERE recency = 1 ORDER BY local_date;
`;

export function normalizeHealthQueryOutput(payload) {
	if (!Array.isArray(payload) || payload.length !== 6) {
		throw new Error("Expected six result sets from D1.");
	}

	const resultSets = payload.map((item) => {
		if (!item || !Array.isArray(item.results)) {
			throw new Error("D1 returned an invalid result set.");
		}
		return item.results;
	});

	return {
		activity: resultSets[0],
		recovery: resultSets[1],
		sleep: resultSets[2],
		vo2Max: resultSets[3],
		medical: resultSets[4],
		weight: resultSets[5],
	};
}

async function queryHealthData() {
	const { stdout } = await execFileAsync(
		wranglerPath.pathname,
		[
			"d1",
			"execute",
			"health-processed-data",
			"--config",
			wranglerConfig.pathname,
			"--remote",
			"--json",
			"--command",
			HEALTH_QUERY,
		],
		{ cwd: projectRoot.pathname, maxBuffer: 8 * 1024 * 1024 },
	);

	return normalizeHealthQueryOutput(JSON.parse(stdout));
}

async function queryHealthDataWithRetry() {
	try {
		return await queryHealthData();
	} catch {
		return queryHealthData();
	}
}

export function healthDataPlugin() {
	let dataPromise;

	return {
		name: "health-dashboard-dev-data",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/__dev/health-data", async (request, response) => {
				if (request.method !== "GET") {
					response.statusCode = 405;
					response.setHeader("Allow", "GET");
					response.end();
					return;
				}

				try {
					dataPromise ??= queryHealthDataWithRetry();
					const data = await dataPromise;
					response.statusCode = 200;
					response.setHeader("Cache-Control", "no-store");
					response.setHeader("Content-Type", "application/json; charset=utf-8");
					response.end(JSON.stringify(data));
				} catch {
					dataPromise = undefined;
					response.statusCode = 500;
					response.setHeader("Cache-Control", "no-store");
					response.setHeader("Content-Type", "application/json; charset=utf-8");
					response.end(JSON.stringify({ error: "Could not read the health database." }));
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
