interface ExerciseTimeRow {
	local_date: string;
	exercise_minutes: number | null;
}

interface WeeklyExerciseTime {
	date: string;
	value: number | null;
}

interface AppleHealthDataRangeInput {
	activity: Array<ExerciseTimeRow & { steps: number | null; active_energy_kj: number | null }>;
	recovery: Array<{
		local_date: string;
		resting_heart_rate: number | null;
		hrv: number | null;
	}>;
	sleep: Array<{
		local_date: string;
		total_sleep_hours: number | null;
		awake_hours?: number | null;
		core_hours?: number | null;
		deep_hours?: number | null;
		rem_hours?: number | null;
	}>;
	vo2Max: Array<{ local_date: string; value: number }>;
	weight: Array<{ local_date: string; value: number }>;
}

const indiaDate = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: "Asia/Kolkata",
});

export const toIndiaDate = (timestamp: number) => {
	const parts = Object.fromEntries(
		indiaDate.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
};

export function getAppleHealthDataRange(data: AppleHealthDataRangeInput) {
	const dates: string[] = [];

	for (const row of data.activity) {
		if (row.steps !== null || row.active_energy_kj !== null || row.exercise_minutes !== null) {
			dates.push(row.local_date);
		}
	}
	for (const row of data.recovery) {
		if (row.resting_heart_rate !== null || row.hrv !== null) dates.push(row.local_date);
	}
	for (const row of data.sleep) {
		if (
			row.total_sleep_hours !== null ||
			row.awake_hours != null ||
			row.core_hours != null ||
			row.deep_hours != null ||
			row.rem_hours != null
		) {
			dates.push(row.local_date);
		}
	}
	for (const row of data.vo2Max) dates.push(row.local_date);
	for (const row of data.weight) dates.push(row.local_date);

	if (dates.length === 0) return null;

	dates.sort((a, b) => a.localeCompare(b));
	return { firstDate: dates[0], lastDate: dates.at(-1) as string };
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

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const mondayFor = (localDate: string) => {
	const date = new Date(`${localDate}T00:00:00Z`);
	const daysSinceMonday = (date.getUTCDay() + 6) % 7;
	return new Date(date.getTime() - daysSinceMonday * DAY_IN_MILLISECONDS)
		.toISOString()
		.slice(0, 10);
};

export function rollUpWeeklyExerciseTime(rows: ExerciseTimeRow[]): WeeklyExerciseTime[] {
	const weeks = new Map<string, { total: number; hasValue: boolean }>();

	for (const row of rows) {
		const monday = mondayFor(row.local_date);
		const week = weeks.get(monday) ?? { total: 0, hasValue: false };
		if (row.exercise_minutes !== null) {
			week.total += row.exercise_minutes;
			week.hasValue = true;
		}
		weeks.set(monday, week);
	}

	return Array.from(weeks, ([date, week]) => ({
		date,
		value: week.hasValue ? week.total : null,
	})).sort((a, b) => a.date.localeCompare(b.date));
}
