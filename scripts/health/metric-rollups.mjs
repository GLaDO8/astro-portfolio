import { METRIC_AGGREGATION_VERSION, METRIC_DEFINITIONS_BY_CODE } from "./metric-definitions.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sqlText(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

function requireDate(value) {
	const parsed = new Date(`${value}T00:00:00Z`);
	if (
		!DATE_PATTERN.test(value) ||
		Number.isNaN(parsed.getTime()) ||
		parsed.toISOString().slice(0, 10) !== value
	) {
		throw new Error("rollup_invalid_date");
	}
	return value;
}

export function mondayStart(localDate) {
	requireDate(localDate);
	const date = new Date(`${localDate}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
	return date.toISOString().slice(0, 10);
}

export function monthStart(localDate) {
	return `${requireDate(localDate).slice(0, 7)}-01`;
}

export function deriveTouchedBuckets(metricSamples) {
	const touched = new Map();
	for (const sample of metricSamples) {
		const definition = METRIC_DEFINITIONS_BY_CODE.get(sample.metricCode);
		if (!definition || definition.rollupMethod === "none") continue;
		requireDate(sample.localDate);
		touched.set(`${sample.metricCode}\0${sample.localDate}`, {
			metricCode: sample.metricCode,
			localDate: sample.localDate,
		});
	}
	return [...touched.values()].sort(
		(left, right) =>
			left.metricCode.localeCompare(right.metricCode) ||
			left.localDate.localeCompare(right.localDate),
	);
}

function touchedValues(touched) {
	if (touched.length === 0) return null;
	return touched
		.map(({ metricCode, localDate }) => `(${sqlText(metricCode)}, ${sqlText(localDate)})`)
		.join(",\n");
}

const mondaySql = (dateExpression) =>
	`date(${dateExpression}, '-' || ((CAST(strftime('%w', ${dateExpression}) AS INTEGER) + 6) % 7) || ' days')`;

function upsertClause() {
	return `ON CONFLICT(metric_id, grain, period_start) DO UPDATE SET
  sample_count = excluded.sample_count,
  value_sum = excluded.value_sum,
  value_min = excluded.value_min,
  value_max = excluded.value_max,
  latest_value = excluded.latest_value,
  latest_observed_at_ms = excluded.latest_observed_at_ms,
  latest_sample_id = excluded.latest_sample_id,
  aggregation_version = excluded.aggregation_version
WHERE metric_rollups.sample_count <> excluded.sample_count
  OR metric_rollups.value_sum <> excluded.value_sum
  OR metric_rollups.value_min <> excluded.value_min
  OR metric_rollups.value_max <> excluded.value_max
  OR metric_rollups.latest_value <> excluded.latest_value
  OR metric_rollups.latest_observed_at_ms <> excluded.latest_observed_at_ms
  OR metric_rollups.latest_sample_id <> excluded.latest_sample_id
  OR metric_rollups.aggregation_version <> excluded.aggregation_version;`;
}

function dailyProjectionSql({ selectedCtes, pendingDeliverySha256 = null }) {
	const deliveryCte = pendingDeliverySha256
		? `, delivery AS (SELECT 1 FROM raw_deliveries WHERE payload_sha256 = ${sqlText(pendingDeliverySha256)} AND transform_status = 'pending')`
		: "";
	const deliveryGuard = pendingDeliverySha256 ? " CROSS JOIN delivery" : "";
	return `WITH ${selectedCtes}${deliveryCte}, source AS (
  SELECT md.id AS metric_id, md.rollup_method, ms.local_date AS period_start,
    COUNT(*) AS sample_count, SUM(ms.value) AS value_sum,
    MIN(COALESCE(ms.value_min, ms.value)) AS value_min,
    MAX(COALESCE(ms.value_max, ms.value)) AS value_max
  FROM selected
  JOIN metric_definitions md ON md.code = selected.metric_code AND md.rollup_method <> 'none'
  JOIN metric_samples ms ON ms.metric_id = md.id AND ms.local_date = selected.local_date
  GROUP BY md.id, md.rollup_method, ms.local_date
), projected AS (
  SELECT source.*,
    (SELECT latest.value FROM metric_samples latest WHERE latest.metric_id = source.metric_id AND latest.local_date = source.period_start ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_value,
    (SELECT latest.observed_at_ms FROM metric_samples latest WHERE latest.metric_id = source.metric_id AND latest.local_date = source.period_start ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_observed_at_ms,
    (SELECT latest.id FROM metric_samples latest WHERE latest.metric_id = source.metric_id AND latest.local_date = source.period_start ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_sample_id
  FROM source
)
INSERT INTO metric_rollups (metric_id, grain, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id, aggregation_version)
SELECT metric_id, 'day', period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id, ${METRIC_AGGREGATION_VERSION}
FROM projected${deliveryGuard} WHERE true
${upsertClause()}`;
}

function higherProjectionSql({ grain, selectedCtes, pendingDeliverySha256 = null }) {
	const periodExpression =
		grain === "week"
			? mondaySql("selected.local_date")
			: "date(selected.local_date, 'start of month')";
	const deliveryCte = pendingDeliverySha256
		? `, delivery AS (SELECT 1 FROM raw_deliveries WHERE payload_sha256 = ${sqlText(pendingDeliverySha256)} AND transform_status = 'pending')`
		: "";
	const deliveryGuard = pendingDeliverySha256 ? " CROSS JOIN delivery" : "";
	const childFilter =
		grain === "week"
			? `daily.period_start >= periods.period_start AND daily.period_start < date(periods.period_start, '+7 days')`
			: `daily.period_start >= periods.period_start AND daily.period_start < date(periods.period_start, '+1 month')`;
	return `WITH ${selectedCtes}, periods AS (
  SELECT DISTINCT md.id AS metric_id, ${periodExpression} AS period_start
  FROM selected JOIN metric_definitions md ON md.code = selected.metric_code AND md.rollup_method <> 'none'
)${deliveryCte}, source AS (
  SELECT periods.metric_id, periods.period_start,
    SUM(daily.sample_count) AS sample_count, SUM(daily.value_sum) AS value_sum,
    MIN(daily.value_min) AS value_min, MAX(daily.value_max) AS value_max
  FROM periods JOIN metric_rollups daily ON daily.metric_id = periods.metric_id AND daily.grain = 'day' AND ${childFilter}
  GROUP BY periods.metric_id, periods.period_start
), projected AS (
  SELECT source.*,
    (SELECT daily.latest_value FROM metric_rollups daily WHERE daily.metric_id = source.metric_id AND daily.grain = 'day' AND ${childFilter.replaceAll("periods.", "source.")} ORDER BY daily.latest_observed_at_ms DESC, daily.latest_sample_id DESC LIMIT 1) AS latest_value,
    (SELECT daily.latest_observed_at_ms FROM metric_rollups daily WHERE daily.metric_id = source.metric_id AND daily.grain = 'day' AND ${childFilter.replaceAll("periods.", "source.")} ORDER BY daily.latest_observed_at_ms DESC, daily.latest_sample_id DESC LIMIT 1) AS latest_observed_at_ms,
    (SELECT daily.latest_sample_id FROM metric_rollups daily WHERE daily.metric_id = source.metric_id AND daily.grain = 'day' AND ${childFilter.replaceAll("periods.", "source.")} ORDER BY daily.latest_observed_at_ms DESC, daily.latest_sample_id DESC LIMIT 1) AS latest_sample_id
  FROM source
)
INSERT INTO metric_rollups (metric_id, grain, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id, aggregation_version)
SELECT metric_id, ${sqlText(grain)}, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id, ${METRIC_AGGREGATION_VERSION}
FROM projected${deliveryGuard} WHERE true
${upsertClause()}`;
}

export function buildTouchedRollupSql({ metricSamples, payloadSha256 }) {
	const touched = deriveTouchedBuckets(metricSamples);
	const selectedSql = touchedValues(touched);
	if (!selectedSql) return [];
	const selectedCtes = `selected(metric_code, local_date) AS (VALUES\n${selectedSql}\n)`;
	return [
		dailyProjectionSql({ selectedCtes, pendingDeliverySha256: payloadSha256 }),
		higherProjectionSql({ grain: "week", selectedCtes, pendingDeliverySha256: payloadSha256 }),
		higherProjectionSql({ grain: "month", selectedCtes, pendingDeliverySha256: payloadSha256 }),
	];
}

function reconciliationInsert(ctes, canonicalSelect, actualSelect) {
	return `WITH ${ctes}
INSERT INTO local_reconciliation_assertion
SELECT COUNT(*) FROM (
  ${canonicalSelect}
  EXCEPT
  ${actualSelect}
  UNION ALL
  ${actualSelect}
  EXCEPT
  ${canonicalSelect}
);`;
}

export function buildTouchedRollupReconciliationSql(metricSamples) {
	const selectedSql = touchedValues(deriveTouchedBuckets(metricSamples));
	if (!selectedSql) return [];
	const selected = `selected(metric_code, local_date) AS (VALUES\n${selectedSql}\n)`;
	const columns =
		"metric_id, period_start, sample_count, value_sum, value_min, value_max, latest_value, latest_observed_at_ms, latest_sample_id, aggregation_version";
	const dailyCtes = `${selected}, canonical AS (
  SELECT md.id AS metric_id, ms.local_date AS period_start, COUNT(*) AS sample_count,
    SUM(ms.value) AS value_sum, MIN(COALESCE(ms.value_min, ms.value)) AS value_min,
    MAX(COALESCE(ms.value_max, ms.value)) AS value_max,
    (SELECT latest.value FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_value,
    (SELECT latest.observed_at_ms FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_observed_at_ms,
    (SELECT latest.id FROM metric_samples latest WHERE latest.metric_id = md.id AND latest.local_date = ms.local_date ORDER BY latest.observed_at_ms DESC, latest.id DESC LIMIT 1) AS latest_sample_id,
    ${METRIC_AGGREGATION_VERSION} AS aggregation_version
  FROM selected JOIN metric_definitions md ON md.code = selected.metric_code
  JOIN metric_samples ms ON ms.metric_id = md.id AND ms.local_date = selected.local_date
  GROUP BY md.id, ms.local_date
), actual AS (
  SELECT mr.* FROM selected JOIN metric_definitions md ON md.code = selected.metric_code
  JOIN metric_rollups mr ON mr.metric_id = md.id AND mr.grain = 'day' AND mr.period_start = selected.local_date
)`;
	const statements = [
		reconciliationInsert(
			dailyCtes,
			`SELECT ${columns} FROM canonical`,
			`SELECT ${columns} FROM actual`,
		),
	];

	for (const grain of ["week", "month"]) {
		const periodExpression =
			grain === "week"
				? mondaySql("selected.local_date")
				: "date(selected.local_date, 'start of month')";
		const childFilter =
			grain === "week"
				? "daily.period_start >= periods.period_start AND daily.period_start < date(periods.period_start, '+7 days')"
				: "daily.period_start >= periods.period_start AND daily.period_start < date(periods.period_start, '+1 month')";
		const ctes = `${selected}, periods AS (
  SELECT DISTINCT md.id AS metric_id, ${periodExpression} AS period_start
  FROM selected JOIN metric_definitions md ON md.code = selected.metric_code
), children AS (
  SELECT periods.metric_id, periods.period_start, daily.sample_count, daily.value_sum, daily.value_min, daily.value_max,
    daily.latest_value, daily.latest_observed_at_ms, daily.latest_sample_id,
    ROW_NUMBER() OVER (PARTITION BY periods.metric_id, periods.period_start ORDER BY daily.latest_observed_at_ms DESC, daily.latest_sample_id DESC) AS recency
  FROM periods JOIN metric_rollups daily ON daily.metric_id = periods.metric_id AND daily.grain = 'day' AND ${childFilter}
), canonical AS (
  SELECT metric_id, period_start, SUM(sample_count) AS sample_count, SUM(value_sum) AS value_sum,
    MIN(value_min) AS value_min, MAX(value_max) AS value_max,
    MAX(CASE WHEN recency = 1 THEN latest_value END) AS latest_value,
    MAX(CASE WHEN recency = 1 THEN latest_observed_at_ms END) AS latest_observed_at_ms,
    MAX(CASE WHEN recency = 1 THEN latest_sample_id END) AS latest_sample_id,
    ${METRIC_AGGREGATION_VERSION} AS aggregation_version
  FROM children GROUP BY metric_id, period_start
), actual AS (
  SELECT mr.* FROM periods JOIN metric_rollups mr ON mr.metric_id = periods.metric_id AND mr.grain = ${sqlText(grain)} AND mr.period_start = periods.period_start
)`;
		statements.push(
			reconciliationInsert(
				ctes,
				`SELECT ${columns} FROM canonical`,
				`SELECT ${columns} FROM actual`,
			),
		);
	}
	return statements;
}

export function buildRangeRollupSql({
	metricCodes,
	start,
	end,
	deleteEmpty = true,
	includeDaily = true,
	includeHigher = true,
}) {
	requireDate(start);
	requireDate(end);
	if (start > end) throw new Error("rollup_invalid_range");
	const codes =
		metricCodes ??
		[...METRIC_DEFINITIONS_BY_CODE.values()]
			.filter(({ rollupMethod }) => rollupMethod !== "none")
			.map(({ code }) => code);
	for (const code of codes) {
		const definition = METRIC_DEFINITIONS_BY_CODE.get(code);
		if (!definition || definition.rollupMethod === "none") throw new Error("rollup_invalid_metric");
	}
	const codeValues = codes.map((code) => `(${sqlText(code)})`).join(", ");
	const selectedCtes = `RECURSIVE codes(metric_code) AS (VALUES ${codeValues}),
dates(local_date) AS (SELECT ${sqlText(start)} UNION ALL SELECT date(local_date, '+1 day') FROM dates WHERE local_date < ${sqlText(end)}),
selected(metric_code, local_date) AS (SELECT metric_code, local_date FROM codes CROSS JOIN dates)`;
	const statements = [];
	if (deleteEmpty && includeDaily) {
		statements.push(
			`DELETE FROM metric_rollups WHERE grain = 'day' AND period_start BETWEEN ${sqlText(start)} AND ${sqlText(end)} AND metric_id IN (SELECT id FROM metric_definitions WHERE code IN (${codes.map(sqlText).join(", ")}));`,
		);
	}
	if (deleteEmpty && includeHigher) {
		statements.push(
			`DELETE FROM metric_rollups WHERE grain = 'week' AND period_start BETWEEN ${sqlText(mondayStart(start))} AND ${sqlText(mondayStart(end))} AND metric_id IN (SELECT id FROM metric_definitions WHERE code IN (${codes.map(sqlText).join(", ")}));`,
			`DELETE FROM metric_rollups WHERE grain = 'month' AND period_start BETWEEN ${sqlText(monthStart(start))} AND ${sqlText(monthStart(end))} AND metric_id IN (SELECT id FROM metric_definitions WHERE code IN (${codes.map(sqlText).join(", ")}));`,
		);
	}
	if (includeDaily) statements.push(dailyProjectionSql({ selectedCtes }));
	if (includeHigher) {
		statements.push(
			higherProjectionSql({ grain: "week", selectedCtes }),
			higherProjectionSql({ grain: "month", selectedCtes }),
		);
	}
	return statements;
}

export { METRIC_AGGREGATION_VERSION };
