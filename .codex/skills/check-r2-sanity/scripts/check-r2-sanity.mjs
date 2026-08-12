#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import process from "node:process";

const HEALTH_R2_BUCKET_NAME = "health-raw-data";
const HEALTH_R2_BINDING = "HEALTH_RAW";
const CONFIG = "workers/health-ingest/wrangler.jsonc";
const WRANGLER = ["pnpm", ["exec", "wrangler"]];
const CORE_METRICS = new Map([
	["steps", ["stepcount", "steps"]],
	["active energy", ["activeenergy", "activeenergyburned"]],
	["basal energy", ["basalenergy", "basalenergyburned"]],
	["heart rate", ["heartrate"]],
	["distance", ["walkingrunningdistance", "distancewalkingrunning", "distance"]],
	["exercise time", ["appleexercisetime", "exercisetime"]],
	["sleep", ["sleepanalysis", "sleep"]],
	["HRV", ["heartratevariability", "hrv", "heartratevariabilitysdnn"]],
	["flights climbed", ["flightsclimbed"]],
]);
const DEFAULT_NUMERIC_FIELDS = ["qty", "Avg", "Min", "Max"];
const SLEEP_SUMMARY_NUMERIC_FIELDS = [
	"asleep",
	"awake",
	"core",
	"deep",
	"inBed",
	"rem",
	"totalSleep",
];

function fail(message) {
	console.error(`check-r2-sanity: ${message}`);
	process.exit(1);
}

function runWrangler(args) {
	try {
		return execFileSync(WRANGLER[0], [...WRANGLER[1], ...args], {
			cwd: process.cwd(),
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (error) {
		const detail = error.stderr?.toString().trim() || error.message;
		fail(`Wrangler failed: ${detail}`);
	}
}

function assertHardcodedBucketBinding() {
	const config = readFileSync(CONFIG, "utf8");
	const expectedBinding = new RegExp(
		`"binding"\\s*:\\s*"${HEALTH_R2_BINDING}"[\\s\\S]{0,200}?"bucket_name"\\s*:\\s*"${HEALTH_R2_BUCKET_NAME}"`,
	);
	if (!expectedBinding.test(config)) {
		fail(
			`hardcoded target ${HEALTH_R2_BUCKET_NAME} no longer matches ${HEALTH_R2_BINDING} in ${CONFIG}`,
		);
	}
}

function getAuth() {
	let identity;
	try {
		identity = JSON.parse(runWrangler(["whoami", "--json"]));
	} catch {
		fail("could not parse `wrangler whoami --json`");
	}
	if (!identity.loggedIn) fail("Wrangler is not authenticated");

	const configuredAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
	const account = configuredAccount
		? identity.accounts.find(({ id }) => id === configuredAccount)
		: identity.accounts.length === 1
			? identity.accounts[0]
			: undefined;
	if (!account) {
		fail(
			configuredAccount
				? "CLOUDFLARE_ACCOUNT_ID is not available to the current Wrangler identity"
				: "multiple Cloudflare accounts are available; set CLOUDFLARE_ACCOUNT_ID explicitly",
		);
	}

	let credentials;
	try {
		credentials = JSON.parse(runWrangler(["auth", "token", "--json"]));
	} catch {
		fail("could not parse `wrangler auth token --json`");
	}
	if (typeof credentials.token !== "string" || !credentials.token) {
		fail("this workflow requires Wrangler OAuth or an API token, not a global API key");
	}
	return { accountId: account.id, token: credentials.token };
}

async function listRemoteObjects() {
	const { accountId, token } = getAuth();
	const objects = [];
	let cursor;
	do {
		const url = new URL(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${HEALTH_R2_BUCKET_NAME}/objects`,
		);
		url.searchParams.set("per_page", "1000");
		if (cursor) url.searchParams.set("cursor", cursor);
		const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
		const body = await response.json();
		if (!response.ok || !body.success) {
			const message = body.errors?.map(({ message: text }) => text).join("; ") || response.statusText;
			fail(`R2 list failed: ${message}`);
		}
		for (const object of body.result ?? []) {
			if (typeof object.key !== "string" || typeof object.size !== "number") {
				fail("R2 list returned an object without a key or size");
			}
			objects.push({
				key: object.key,
				size: object.size,
				etag: object.etag ?? null,
				lastModified: object.last_modified ?? null,
			});
		}
		cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
		if (body.result_info?.is_truncated && !cursor) fail("R2 pagination was truncated without a cursor");
	} while (cursor);
	objects.sort((a, b) => a.key.localeCompare(b.key));
	return objects;
}

function downloadObject(object, path) {
	runWrangler([
		"r2",
		"object",
		"get",
		`${HEALTH_R2_BUCKET_NAME}/${object.key}`,
		"--remote",
		"--file",
		path,
		"--config",
		CONFIG,
	]);
}

function localObjects(directory) {
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.map((entry) => {
			const path = join(directory, entry.name);
			return { key: entry.name, size: statSync(path).size, lastModified: null, path };
		})
		.sort((a, b) => a.key.localeCompare(b.key));
}

function normalizedMetricName(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function hasInvalidNumericData(metricName, row) {
	if (!row || typeof row !== "object" || Array.isArray(row)) return true;

	const isSleepSummary = normalizedMetricName(metricName) === "sleepanalysis";
	const expectedFields = isSleepSummary ? SLEEP_SUMMARY_NUMERIC_FIELDS : DEFAULT_NUMERIC_FIELDS;
	const presentFields = expectedFields.filter((field) => field in row);

	return (
		presentFields.length === 0 ||
		presentFields.some(
			(field) =>
				typeof row[field] !== "number" ||
				!Number.isFinite(row[field]) ||
				(isSleepSummary && row[field] < 0),
		)
	);
}

function parseTimestamp(value) {
	if (typeof value !== "string" || value.length < 10) return null;
	let candidate = value.trim();
	const healthMatch = candidate.match(
		/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{2})(\d{2})$/,
	);
	if (healthMatch) candidate = `${healthMatch[1]}T${healthMatch[2]}${healthMatch[3]}:${healthMatch[4]}`;
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate)) {
		return null;
	}
	const datePart = candidate.slice(0, 10);
	if (!isCalendarDate(datePart)) return null;
	const timestamp = Date.parse(candidate);
	return Number.isFinite(timestamp) ? timestamp : null;
}

function isCalendarDate(value) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function dayFromTimestamp(timestamp) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function observedDay(value, timestamp) {
	const match = typeof value === "string" ? value.match(/^(\d{4}-\d{2}-\d{2})/) : null;
	return match?.[1] ?? dayFromTimestamp(timestamp);
}

function timestampEntries(object) {
	if (!object || typeof object !== "object" || Array.isArray(object)) return [];
	return Object.entries(object).filter(
		([key, value]) =>
			typeof value === "string" && /^(date|start|end|timestamp|time)(date|time)?$/i.test(key),
	);
}

function findSeries(value, path = [], output = []) {
	if (!value || typeof value !== "object") return output;
	if (Array.isArray(value)) {
		const name = path.join(".");
		const knownSeries =
			/(active.?energy|basal.?energy|heart.?rate|step|distance|speed|pace|cadence|power|elevation|altitude|route|location|gpx|oxygen|temperature)/i.test(
				name,
			);
		if (knownSeries && value.length > 0) output.push({ name, points: value });
		for (const item of value) findSeries(item, path, output);
		return output;
	}
	for (const [key, child] of Object.entries(value)) findSeries(child, [...path, key], output);
	return output;
}

function missingDays(days) {
	if (days.size < 2) return [];
	const sorted = [...days].sort();
	const cursor = new Date(`${sorted[0]}T00:00:00Z`);
	const end = new Date(`${sorted.at(-1)}T00:00:00Z`);
	const missing = [];
	while (cursor <= end) {
		const day = cursor.toISOString().slice(0, 10);
		if (!days.has(day)) missing.push(day);
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return missing;
}

function dateRange(start, end) {
	if (!start || !end) return [];
	const cursor = new Date(`${start}T00:00:00Z`);
	const limit = new Date(`${end}T00:00:00Z`);
	if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(limit.getTime()) || cursor > limit) {
		fail("expected dates must be valid YYYY-MM-DD values with start on or before end");
	}
	const days = [];
	while (cursor <= limit) {
		days.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return days;
}

function metricAccumulator(name) {
	return {
		name,
		units: new Set(),
		rowKeys: new Set(),
		sourceDigests: new Set(),
		rowsByMonth: new Map(),
		rowDigests: new Map(),
		rows: 0,
		sourceRows: 0,
		validTimestamps: 0,
		invalidTimestamps: 0,
		invalidNumericRows: 0,
		days: new Set(),
	};
}

function analyze(objects, getBody, expectedRange) {
	const metrics = new Map();
	const payloadDigests = new Map();
	const workoutIds = new Map();
	const workoutSeries = new Map();
	const observedDays = new Set();
	const metricObservedDays = new Set();
	const workoutObservedDays = new Set();
	let parseFailures = 0;
	let metricObjects = 0;
	let workoutObjects = 0;
	let unknownObjects = 0;
	let invalidEnvelopes = 0;
	let workoutRecords = 0;
	let workoutsWithSeries = 0;
	let workoutSeriesPoints = 0;
	let workoutSeriesInvalidTimestamps = 0;
	let workoutPointsOutsideInterval = 0;
	let routePoints = 0;
	let routePointsOutsideInterval = 0;

	for (const object of objects) {
		let raw;
		let payload;
		try {
			raw = getBody(object);
			payload = JSON.parse(raw);
		} catch {
			parseFailures += 1;
			continue;
		}

		const digest = createHash("sha256").update(raw).digest("hex");
		payloadDigests.set(digest, (payloadDigests.get(digest) ?? 0) + 1);
		const metricPayload = Array.isArray(payload?.data?.metrics);
		const workoutPayload = Array.isArray(payload?.data?.workouts);
		if (!metricPayload && !workoutPayload) unknownObjects += 1;

		if (metricPayload) {
			metricObjects += 1;
			for (const metric of payload.data.metrics) {
				const name = typeof metric?.name === "string" && metric.name ? metric.name : "(missing name)";
				const aggregate = metrics.get(name) ?? metricAccumulator(name);
				if (metric?.units != null) aggregate.units.add(String(metric.units));
				if (!Array.isArray(metric?.data)) {
					invalidEnvelopes += 1;
					continue;
				}
				const rows = metric.data;
				aggregate.rows += rows.length;
				for (const row of rows) {
					if (row && typeof row === "object" && !Array.isArray(row)) {
						for (const key of Object.keys(row)) aggregate.rowKeys.add(key);
					}
					if (hasInvalidNumericData(name, row)) {
						aggregate.invalidNumericRows += 1;
					}
					const rowDigest = createHash("sha256")
						.update(JSON.stringify(row))
						.digest("hex");
					aggregate.rowDigests.set(rowDigest, (aggregate.rowDigests.get(rowDigest) ?? 0) + 1);
					if (row && typeof row === "object" && row.source != null) {
						aggregate.sourceRows += 1;
						const sourceDigest = createHash("sha256")
							.update(typeof row.source === "string" ? row.source : JSON.stringify(row.source))
							.digest("hex");
						aggregate.sourceDigests.add(sourceDigest);
					}
					const entries = timestampEntries(row);
					if (entries.length === 0) {
						aggregate.invalidTimestamps += 1;
						continue;
					}
					let rowMonth;
					for (const [, value] of entries) {
						const timestamp = parseTimestamp(value);
						if (timestamp == null) aggregate.invalidTimestamps += 1;
						else {
							aggregate.validTimestamps += 1;
							const day = observedDay(value, timestamp);
							aggregate.days.add(day);
							observedDays.add(day);
							metricObservedDays.add(day);
							rowMonth ??= day.slice(0, 7);
						}
					}
					if (rowMonth) {
						aggregate.rowsByMonth.set(rowMonth, (aggregate.rowsByMonth.get(rowMonth) ?? 0) + 1);
					}
				}
				metrics.set(name, aggregate);
			}
		}

		if (workoutPayload) {
			workoutObjects += 1;
			for (const workout of payload.data.workouts) {
				workoutRecords += 1;
				if (!workout || typeof workout !== "object" || Array.isArray(workout)) {
					invalidEnvelopes += 1;
					continue;
				}
				const id = workout?.id ?? workout?.uuid ?? workout?.UUID;
				if (typeof id === "string" && id) workoutIds.set(id, (workoutIds.get(id) ?? 0) + 1);
				const startValue = workout?.start ?? workout?.startDate;
				const endValue = workout?.end ?? workout?.endDate;
				const start = parseTimestamp(startValue);
				const end = parseTimestamp(endValue);
				if (start == null || end == null || start > end) invalidEnvelopes += 1;
				if (start != null) {
					const day = observedDay(startValue, start);
					observedDays.add(day);
					workoutObservedDays.add(day);
				}
				if (end != null) {
					const day = observedDay(endValue, end);
					observedDays.add(day);
					workoutObservedDays.add(day);
				}

				const series = findSeries(workout).filter(({ name }) => name !== "");
				if (series.length > 0) workoutsWithSeries += 1;
				for (const current of series) {
					const seriesName = current.name.replace(/^data\./, "");
					const summary = workoutSeries.get(seriesName) ?? { arrays: 0, points: 0 };
					summary.arrays += 1;
					summary.points += current.points.length;
					workoutSeries.set(seriesName, summary);
					const isRoute = /route|gpx|location/i.test(seriesName);
					for (const point of current.points) {
							workoutSeriesPoints += 1;
							if (isRoute) routePoints += 1;
							const entries = timestampEntries(point);
							let pointInvalid = false;
							let pointOutside = false;
							if (entries.length === 0) pointInvalid = true;
						for (const [, value] of entries) {
							const timestamp = parseTimestamp(value);
							if (timestamp == null) pointInvalid = true;
							else if (start != null && end != null && (timestamp < start || timestamp > end)) {
								pointOutside = true;
							}
						}
						if (pointInvalid) workoutSeriesInvalidTimestamps += 1;
						if (pointOutside) {
							workoutPointsOutsideInterval += 1;
							if (isRoute) routePointsOutsideInterval += 1;
						}
					}
				}
			}
		}
	}

	const metricReports = [...metrics.values()]
		.map((metric) => {
			const days = [...metric.days].sort();
			return {
				name: metric.name,
				units: [...metric.units].sort(),
				rowKeys: [...metric.rowKeys].sort(),
				rows: metric.rows,
				sourceRows: metric.sourceRows,
				uniqueSources: metric.sourceDigests.size,
				rowsByMonth: Object.fromEntries([...metric.rowsByMonth].sort(([a], [b]) => a.localeCompare(b))),
				duplicateRowGroups: [...metric.rowDigests.values()].filter((count) => count > 1).length,
				duplicateRows: [...metric.rowDigests.values()]
					.filter((count) => count > 1)
					.reduce((sum, count) => sum + count, 0),
				validTimestamps: metric.validTimestamps,
				invalidTimestamps: metric.invalidTimestamps,
				invalidNumericRows: metric.invalidNumericRows,
				observedDateStart: days[0] ?? null,
				observedDateEnd: days.at(-1) ?? null,
				distinctDates: days.length,
				missingDatesWithinObservedSpan: missingDays(metric.days),
				missingExpectedDates: expectedRange.start
					? dateRange(expectedRange.start, expectedRange.end).filter((day) => !metric.days.has(day))
					: [],
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	const normalizedNames = new Set(metricReports.map(({ name }) => normalizedMetricName(name)));
	const missingCoreMetrics = [...CORE_METRICS]
		.filter(([, aliases]) => !aliases.some((alias) => normalizedNames.has(alias)))
		.map(([label]) => label);
	const duplicatePayloadGroups = [...payloadDigests.values()].filter((count) => count > 1);
	const duplicateWorkoutIds = [...workoutIds.values()].filter((count) => count > 1);
	const coverageDays = metricObservedDays.size > 0 ? metricObservedDays : observedDays;
	const missing = missingDays(coverageDays);
	const expectedDays = dateRange(expectedRange.start, expectedRange.end);
	const missingExpectedDays = expectedDays.filter((day) => !coverageDays.has(day));
	const expectedDaySet = new Set(expectedDays);
	const outsideExpectedDays =
		expectedDays.length > 0 ? [...coverageDays].filter((day) => !expectedDaySet.has(day)).sort() : [];
	const invalidMetricTimestamps = metricReports.reduce(
		(sum, metric) => sum + metric.invalidTimestamps,
		0,
	);
	const invalidNumericRows = metricReports.reduce((sum, metric) => sum + metric.invalidNumericRows, 0);
	const metricsWithExpectedGaps = metricReports.filter(
		(metric) => metric.missingExpectedDates.length > 0,
	).length;

	const failures = [];
	const warnings = [];
	if (parseFailures > 0) failures.push("json_parse_failures");
	if (unknownObjects > 0) failures.push("unknown_envelopes");
	if (invalidEnvelopes > 0) failures.push("invalid_envelopes");
	if (invalidMetricTimestamps + workoutSeriesInvalidTimestamps > 0) failures.push("invalid_timestamps");
	if (invalidNumericRows > 0) failures.push("invalid_numeric_metric_rows");
	if (workoutPointsOutsideInterval > 0) failures.push("workout_series_outside_declared_interval");
	if (missingExpectedDays.length > 0) failures.push("missing_expected_dates");
	if (objects.length === 0) warnings.push("empty_bucket");
	if (metricObjects === 0) warnings.push("no_metric_deliveries");
	if (missing.length > 0) warnings.push("gaps_within_observed_date_span");
	if (missingCoreMetrics.length > 0) warnings.push("missing_core_metrics");
	if (workoutRecords > 0 && workoutsWithSeries < workoutRecords) warnings.push("summary_only_workouts_present");
	if (duplicatePayloadGroups.length > 0) warnings.push("duplicate_payloads_present");
	if (duplicateWorkoutIds.length > 0) warnings.push("duplicate_workout_ids_present");
	if (outsideExpectedDays.length > 0) warnings.push("dates_outside_expected_interval");
	if (metricsWithExpectedGaps > 0) warnings.push("per_metric_expected_gaps");
	if (metricReports.some((metric) => metric.units.length === 0)) warnings.push("metrics_without_units");
	if (metricReports.some((metric) => metric.units.length > 1)) warnings.push("metric_unit_drift");
	if ([...workoutIds.values()].reduce((sum, count) => sum + count, 0) < workoutRecords) {
		warnings.push("workouts_without_ids");
	}
	if (metricReports.some((metric) => metric.duplicateRows > 0)) warnings.push("duplicate_metric_rows_present");

	const inventoryBytes = objects.reduce((sum, object) => sum + object.size, 0);
	const modified = objects.map(({ lastModified }) => lastModified).filter(Boolean).sort();
	const observed = [...observedDays].sort();
	const metricObserved = [...metricObservedDays].sort();
	const workoutObserved = [...workoutObservedDays].sort();
	return {
		status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
		auditedAt: new Date().toISOString(),
		privacy: "aggregate-only; no health values, payload fragments, workout names, GPS, or object keys",
		failures,
		warnings,
		inventory: {
			objects: objects.length,
			bytes: inventoryBytes,
			receivedAtStart: modified[0] ?? null,
			receivedAtEnd: modified.at(-1) ?? null,
		},
		integrity: {
			parseFailures,
			unknownObjects,
			invalidEnvelopes,
			duplicatePayloadGroups: duplicatePayloadGroups.length,
			duplicatePayloadObjects: duplicatePayloadGroups.reduce((sum, count) => sum + count, 0),
		},
		coverage: {
			expectedDateStart: expectedRange.start,
			expectedDateEnd: expectedRange.end,
			observedDateStart: observed[0] ?? null,
			observedDateEnd: observed.at(-1) ?? null,
			distinctDates: observed.length,
			metricDateStart: metricObserved[0] ?? null,
			metricDateEnd: metricObserved.at(-1) ?? null,
			metricDistinctDates: metricObserved.length,
			workoutDateStart: workoutObserved[0] ?? null,
			workoutDateEnd: workoutObserved.at(-1) ?? null,
			workoutDistinctDates: workoutObserved.length,
			missingDatesWithinObservedSpan: missing,
			missingExpectedDates: missingExpectedDays,
			datesOutsideExpectedInterval: outsideExpectedDays,
			note: "payload dates are coverage; R2 receipt times are delivery lineage only",
		},
		metrics: {
			objects: metricObjects,
			types: metricReports.length,
			missingCoreMetrics,
			rows: metricReports.reduce((sum, metric) => sum + metric.rows, 0),
			invalidTimestamps: invalidMetricTimestamps,
			invalidNumericRows,
			metricsWithExpectedGaps,
			byMetric: metricReports,
		},
		workouts: {
			objects: workoutObjects,
			records: workoutRecords,
			recordsWithId: [...workoutIds.values()].reduce((sum, count) => sum + count, 0),
			uniqueIds: workoutIds.size,
			duplicateIds: duplicateWorkoutIds.length,
			withSeries: workoutsWithSeries,
			summaryOnly: Math.max(0, workoutRecords - workoutsWithSeries),
			seriesPoints: workoutSeriesPoints,
			invalidSeriesTimestamps: workoutSeriesInvalidTimestamps,
			pointsOutsideDeclaredInterval: workoutPointsOutsideInterval,
			routePoints,
			routePointsOutsideDeclaredInterval: routePointsOutsideInterval,
			series: Object.fromEntries([...workoutSeries].sort(([a], [b]) => a.localeCompare(b))),
		},
	};
}

function parseArguments() {
	const args = process.argv.slice(2);
	let inputDir = null;
	let expectedStart = null;
	let expectedEnd = null;
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		const value = args[index + 1];
		if (!value) fail(`missing value for ${flag}`);
		if (flag === "--input-dir") inputDir = resolve(value);
		else if (flag === "--expected-start") expectedStart = value;
		else if (flag === "--expected-end") expectedEnd = value;
		else fail(`unknown option ${flag}`);
	}
	if ((expectedStart == null) !== (expectedEnd == null)) {
		fail("--expected-start and --expected-end must be provided together");
	}
	if (expectedStart && !isCalendarDate(expectedStart)) fail("invalid --expected-start");
	if (expectedEnd && !isCalendarDate(expectedEnd)) fail("invalid --expected-end");
	return { inputDir, expectedRange: { start: expectedStart, end: expectedEnd } };
}

assertHardcodedBucketBinding();
const { inputDir, expectedRange } = parseArguments();
let temporaryDirectory;
try {
	let objects;
	let getBody;
	if (inputDir) {
		objects = localObjects(inputDir);
		getBody = (object) => readFileSync(object.path);
	} else {
		objects = await listRemoteObjects();
		temporaryDirectory = mkdtempSync(join(tmpdir(), "health-r2-sanity-"));
		chmodSync(temporaryDirectory, 0o700);
		for (const [index, object] of objects.entries()) {
			const path = join(temporaryDirectory, `${String(index).padStart(6, "0")}-${basename(object.key)}`);
			downloadObject(object, path);
			object.path = path;
			if ((index + 1) % 25 === 0 || index + 1 === objects.length) {
				console.error(`Audited download ${index + 1}/${objects.length}`);
			}
		}
		getBody = (object) => readFileSync(object.path);
	}
	const report = analyze(objects, getBody, expectedRange);
	console.log(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status === "fail") process.exitCode = 1;
} finally {
	if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
}
