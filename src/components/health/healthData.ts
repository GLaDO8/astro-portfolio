interface AppleHealthDataRangeInput {
	coverage: { firstDate: string | null; lastDate: string | null };
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
	return data.coverage.firstDate && data.coverage.lastDate ? data.coverage : null;
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
