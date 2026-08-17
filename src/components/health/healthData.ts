interface AppleHealthDataRangeInput {
	coverage: { firstDate: string | null; lastDate: string | null };
}

interface DatedValue {
	local_date: string;
	value: number;
}

interface SleepTimingInput {
	local_date: string;
	sleep_start_ms: number | null;
	sleep_end_ms: number | null;
	total_sleep_hours: number | null;
}

const indiaDate = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: "Asia/Kolkata",
});

const indiaDateTime = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
	timeZone: "Asia/Kolkata",
});

const DAY_MS = 86_400_000;

function zonedHourFromLocalDate(timestamp: number, localDate: string) {
	const parts = Object.fromEntries(
		indiaDateTime.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
	);
	const observedDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
	const anchorDay = Date.parse(`${localDate}T00:00:00Z`);
	return ((observedDay - anchorDay) / DAY_MS) * 24 + Number(parts.hour) + Number(parts.minute) / 60;
}

function standardDeviation(values: number[]) {
	if (values.length === 0) return null;
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

export const toIndiaDate = (timestamp: number) => {
	const parts = Object.fromEntries(
		indiaDate.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
};

export function getAppleHealthDataRange(data: AppleHealthDataRangeInput) {
	const { firstDate, lastDate } = data.coverage;
	return firstDate && lastDate ? { firstDate, lastDate } : null;
}

export function getLatestMedicalDate(rows: Array<{ collected_at_ms: number }>) {
	let latestTimestamp: number | null = null;

	for (const row of rows) {
		if (latestTimestamp === null || row.collected_at_ms > latestTimestamp) {
			latestTimestamp = row.collected_at_ms;
		}
	}

	return latestTimestamp === null ? null : toIndiaDate(latestTimestamp);
}

export function getAbsoluteVo2Max(vo2Rows: DatedValue[], weightRows: DatedValue[]) {
	const weights = [...weightRows].sort((left, right) =>
		left.local_date.localeCompare(right.local_date),
	);
	let weightIndex = -1;

	return [...vo2Rows]
		.sort((left, right) => left.local_date.localeCompare(right.local_date))
		.flatMap((row) => {
			while (
				weightIndex + 1 < weights.length &&
				weights[weightIndex + 1].local_date <= row.local_date
			) {
				weightIndex += 1;
			}
			const weight = weights[weightIndex];
			return weight
				? [{ date: row.local_date, value: row.value * weight.value, weightDate: weight.local_date }]
				: [];
		});
}

export function getSleepRegularity(rows: SleepTimingInput[], windowSize = 28) {
	const observed = rows.flatMap((row) => {
		if (
			typeof row.sleep_start_ms !== "number" ||
			typeof row.sleep_end_ms !== "number" ||
			typeof row.total_sleep_hours !== "number"
		) {
			return [];
		}
		const onsetHour = zonedHourFromLocalDate(row.sleep_start_ms, row.local_date);
		const wakeHour = zonedHourFromLocalDate(row.sleep_end_ms, row.local_date);
		return [
			{
				date: row.local_date,
				onsetHour,
				wakeHour,
				midpointHour: (onsetHour + wakeHour) / 2,
				durationHours: row.total_sleep_hours,
			},
		];
	});

	return observed.map((row, index) => {
		const window = observed.slice(Math.max(0, index - windowSize + 1), index + 1);
		return {
			...row,
			onsetVariabilityMinutes: (standardDeviation(window.map((item) => item.onsetHour)) ?? 0) * 60,
			wakeVariabilityMinutes: (standardDeviation(window.map((item) => item.wakeHour)) ?? 0) * 60,
			midpointVariabilityMinutes:
				(standardDeviation(window.map((item) => item.midpointHour)) ?? 0) * 60,
			durationVariabilityMinutes:
				(standardDeviation(window.map((item) => item.durationHours)) ?? 0) * 60,
		};
	});
}

export function formatClockHour(value: number) {
	const minutes = Math.round(value * 60);
	const wrapped = ((minutes % 1440) + 1440) % 1440;
	const hour = Math.floor(wrapped / 60);
	const minute = wrapped % 60;
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
