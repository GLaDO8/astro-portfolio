interface ExerciseTimeRow {
	local_date: string;
	exercise_minutes: number | null;
}

interface WeeklyExerciseTime {
	date: string;
	value: number | null;
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
