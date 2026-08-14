import { createHash } from "node:crypto";

import { METRIC_DEFINITIONS_BY_CODE, SLEEP_DEFINITION } from "./metric-definitions.mjs";

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;
const SCALAR_KEYS = new Set(["date", "qty", "source"]);
const RANGE_KEYS = new Set(["Avg", "Max", "Min", "date", "source"]);
const IGNORED_METRIC_CODES = new Set(["caffeine", "total_fat"]);
const SLEEP_KEYS = new Set([
	"asleep",
	"awake",
	"core",
	"date",
	"deep",
	"inBed",
	"inBedEnd",
	"inBedStart",
	"rem",
	"sleepEnd",
	"sleepStart",
	"source",
	"totalSleep",
]);

export class HealthTransformError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "HealthTransformError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new HealthTransformError(code, message);
}

function assertObject(value, code = "invalid_envelope") {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		fail(code, "Expected an object.");
	}
}

function hasOnlyKnownKeys(row, allowed) {
	return Object.keys(row).every((key) => allowed.has(key));
}

function optionalString(value) {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") fail("row_shape_drift", "Expected an optional string.");
	return value;
}

function finiteNumber(value, required = true) {
	if ((value === undefined || value === null) && !required) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		fail("invalid_number", "Expected a finite JSON number.");
	}
	return value;
}

function parseTimestamp(value, required = true) {
	if ((value === undefined || value === null) && !required) return null;
	if (typeof value !== "string") fail("invalid_timestamp", "Expected a timestamp string.");
	const match = TIMESTAMP.exec(value);
	if (!match) fail("invalid_timestamp", "Timestamp does not match the export contract.");
	const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
	const offsetMinutes = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === "+" ? 1 : -1);
	if (Number(offsetHour) > 23 || Number(offsetMinute) > 59) {
		fail("invalid_timestamp", "Timestamp offset is invalid.");
	}
	const utcMs =
		Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
		) -
		offsetMinutes * 60_000;
	const date = new Date(utcMs + offsetMinutes * 60_000);
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day) ||
		date.getUTCHours() !== Number(hour)
	) {
		fail("invalid_timestamp", "Timestamp calendar fields are invalid.");
	}
	return {
		observedAtMs: utcMs,
		utcOffsetMinutes: offsetMinutes,
		localDate: `${year}-${month}-${day}`,
		localHour: Number(hour),
	};
}

function followingDate(localDate) {
	const date = new Date(`${localDate}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString().slice(0, 10);
}

function semanticKey(parts) {
	return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function normalizeScalar(definition, row) {
	assertObject(row, "row_shape_drift");
	if (!hasOnlyKnownKeys(row, SCALAR_KEYS) || !("date" in row) || !("qty" in row)) {
		fail("row_shape_drift", `Unexpected scalar row for ${definition.code}.`);
	}
	const timestamp = parseTimestamp(row.date);
	const value = finiteNumber(row.qty);
	const sourceName = optionalString(row.source);
	const localDate =
		definition.code === "apple_sleeping_wrist_temperature" && timestamp.localHour >= 12
			? followingDate(timestamp.localDate)
			: timestamp.localDate;
	return {
		metricCode: definition.code,
		unit: definition.unit,
		observedAtMs: timestamp.observedAtMs,
		localDate,
		utcOffsetMinutes: timestamp.utcOffsetMinutes,
		value,
		valueMin: null,
		valueMax: null,
		sourceName,
		semanticKey: semanticKey([
			definition.code,
			definition.unit,
			row.date,
			value,
			null,
			null,
			sourceName,
		]),
	};
}

function normalizeRange(definition, row) {
	assertObject(row, "row_shape_drift");
	if (
		!hasOnlyKnownKeys(row, RANGE_KEYS) ||
		!["date", "Avg", "Min", "Max"].every((key) => key in row)
	) {
		fail("row_shape_drift", `Unexpected range row for ${definition.code}.`);
	}
	const timestamp = parseTimestamp(row.date);
	const value = finiteNumber(row.Avg);
	const valueMin = finiteNumber(row.Min);
	const valueMax = finiteNumber(row.Max);
	if (valueMin > valueMax) fail("invalid_range", "Heart-rate minimum exceeds its maximum.");
	const sourceName = optionalString(row.source);
	return {
		metricCode: definition.code,
		unit: definition.unit,
		observedAtMs: timestamp.observedAtMs,
		localDate: timestamp.localDate,
		utcOffsetMinutes: timestamp.utcOffsetMinutes,
		value,
		valueMin,
		valueMax,
		sourceName,
		semanticKey: semanticKey([
			definition.code,
			definition.unit,
			row.date,
			value,
			valueMin,
			valueMax,
			sourceName,
		]),
	};
}

function normalizeSleep(row) {
	assertObject(row, "row_shape_drift");
	if (!hasOnlyKnownKeys(row, SLEEP_KEYS) || !("date" in row)) {
		fail("row_shape_drift", "Unexpected sleep row.");
	}
	const timestamp = parseTimestamp(row.date);
	const sourceName = optionalString(row.source);
	const sleepStartMs = parseTimestamp(row.sleepStart, false)?.observedAtMs ?? null;
	const sleepEndMs = parseTimestamp(row.sleepEnd, false)?.observedAtMs ?? null;
	const summary = {
		localDate: timestamp.localDate,
		sleepStartMs,
		sleepEndMs,
		totalSleepHours: finiteNumber(row.totalSleep, false),
		awakeHours: finiteNumber(row.awake, false),
		coreHours: finiteNumber(row.core, false),
		deepHours: finiteNumber(row.deep, false),
		remHours: finiteNumber(row.rem, false),
		sourceName,
	};
	return {
		...summary,
		observedAtMs: timestamp.observedAtMs,
		semanticKey: semanticKey([
			SLEEP_DEFINITION.code,
			SLEEP_DEFINITION.unit,
			row.date,
			...Object.values(summary),
		]),
	};
}

export function normalizeHealthAutoExport(payload) {
	assertObject(payload);
	assertObject(payload.data);
	if (!Array.isArray(payload.data.metrics) || payload.data.metrics.length === 0) {
		fail("invalid_envelope", "Expected a non-empty data.metrics array.");
	}

	const metricSamples = [];
	const sleepSummaries = [];
	const seen = new Set();
	const temperatureDays = new Map();
	let inputRows = 0;
	let exactDuplicates = 0;
	let ignoredRows = 0;
	const ignoredMetrics = [];

	for (const metric of payload.data.metrics) {
		assertObject(metric, "invalid_envelope");
		if (
			typeof metric.name !== "string" ||
			typeof metric.units !== "string" ||
			!Array.isArray(metric.data)
		) {
			fail("invalid_envelope", "Metric groups require name, units, and data.");
		}
		if (IGNORED_METRIC_CODES.has(metric.name)) {
			ignoredRows += metric.data.length;
			ignoredMetrics.push(metric.name);
			continue;
		}
		const isSleep = metric.name === SLEEP_DEFINITION.code;
		const definition = METRIC_DEFINITIONS_BY_CODE.get(metric.name);
		if (!definition && !isSleep) fail("unknown_metric", `Unknown metric: ${metric.name}`);
		const expectedUnit = isSleep ? SLEEP_DEFINITION.unit : definition.unit;
		if (metric.units !== expectedUnit) fail("unit_drift", `Unexpected unit for ${metric.name}.`);

		for (const row of metric.data) {
			inputRows += 1;
			const normalized = isSleep
				? normalizeSleep(row)
				: definition.code === "heart_rate"
					? normalizeRange(definition, row)
					: normalizeScalar(definition, row);
			if (seen.has(normalized.semanticKey)) {
				exactDuplicates += 1;
				continue;
			}
			seen.add(normalized.semanticKey);

			if (normalized.metricCode === "apple_sleeping_wrist_temperature") {
				const dailyKey = `${normalized.localDate}\0${normalized.sourceName ?? ""}`;
				const prior = temperatureDays.get(dailyKey);
				if (prior && prior !== normalized.semanticKey) {
					fail("temperature_daily_conflict", "Conflicting wrist temperatures share a wake day.");
				}
				temperatureDays.set(dailyKey, normalized.semanticKey);
			}

			if (isSleep) sleepSummaries.push(normalized);
			else metricSamples.push(normalized);
		}
	}

	const timestamps = [
		...metricSamples.map(({ observedAtMs }) => observedAtMs),
		...sleepSummaries
			.flatMap(({ observedAtMs, sleepStartMs, sleepEndMs }) => [
				observedAtMs,
				sleepStartMs,
				sleepEndMs,
			])
			.filter(Number.isFinite),
	];
	if (timestamps.length === 0) fail("empty_payload", "Payload contains no observations.");

	return {
		metricSamples,
		sleepSummaries,
		inputRows,
		ignoredRows,
		ignoredMetrics,
		exactDuplicates,
		observedStartMs: Math.min(...timestamps),
		observedEndMs: Math.max(...timestamps),
	};
}
