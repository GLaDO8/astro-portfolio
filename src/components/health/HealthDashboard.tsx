import { useEffect, useState } from "react";
import MetricSummary from "./MetricSummary";
import SleepChart from "./SleepChart";
import TrendChart from "./TrendChart";

interface ActivityRow {
	local_date: string;
	steps: number | null;
	active_energy_kj: number | null;
	exercise_minutes: number | null;
}

interface RecoveryRow {
	local_date: string;
	resting_heart_rate: number | null;
	hrv: number | null;
}

interface SleepRow {
	local_date: string;
	total_sleep_hours: number | null;
	awake_hours: number | null;
	core_hours: number | null;
	deep_hours: number | null;
	rem_hours: number | null;
}

interface MedicalRow {
	metric_code: "hba1c" | "cholesterol_ldl_calculated" | "vitamin_d_25_oh";
	collected_at_ms: number;
	value: number;
	unit: string;
	qualifier: string | null;
}

interface HealthData {
	activity: ActivityRow[];
	recovery: RecoveryRow[];
	sleep: SleepRow[];
	vo2Max: { local_date: string; value: number }[];
	medical: MedicalRow[];
}

const medicalDefinitions = {
	hba1c: {
		title: "HbA1c",
		description: "Estimated average glucose exposure over roughly two to three months.",
		color: "var(--color-health-warm)",
	},
	cholesterol_ldl_calculated: {
		title: "Calculated LDL cholesterol",
		description: "Lab-estimated cholesterol carried in LDL particles.",
		color: "var(--color-health-blue)",
	},
	vitamin_d_25_oh: {
		title: "25-hydroxy vitamin D",
		description: "The main circulating measurement used to assess vitamin D status.",
		color: "var(--color-health-gold)",
	},
} as const;

const average = (values: Array<number | null>) => {
	const observed = values.filter((value): value is number => value !== null);
	return observed.length > 0
		? observed.reduce((total, value) => total + value, 0) / observed.length
		: null;
};

const latest = (values: Array<number | null>) => values.findLast((value) => value !== null) ?? null;

const formatNumber = (value: number | null, digits = 0) =>
	value === null
		? "—"
		: value.toLocaleString(undefined, {
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
			});

const indiaDate = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: "Asia/Kolkata",
});

const toIndiaDate = (timestamp: number) => {
	const parts = Object.fromEntries(
		indiaDate.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
};

export default function HealthDashboard() {
	const [data, setData] = useState<HealthData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		fetch("/__dev/health-data", { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Health data request failed.");
				}
				return response.json() as Promise<HealthData>;
			})
			.then(setData)
			.catch((requestError: unknown) => {
				if (requestError instanceof DOMException && requestError.name === "AbortError") {
					return;
				}
				setError("Could not read D1. Check your Cloudflare login and reload this page.");
			});

		return () => controller.abort();
	}, []);

	if (error) {
		return <p className="border-y border-tertiary py-8 font-sans text-sm text-primary">{error}</p>;
	}

	if (!data) {
		return (
			<p className="border-y border-tertiary py-8 font-sans text-sm text-secondary" role="status">
				Reading selected metrics from D1…
			</p>
		);
	}

	const latestActivity = data.activity.at(-1);
	const averageSleep = average(data.sleep.map((row) => row.total_sleep_hours));
	const latestRestingHeartRate = latest(data.recovery.map((row) => row.resting_heart_rate));
	const latestVo2Max = data.vo2Max.at(-1)?.value ?? null;

	return (
		<div className="space-y-14">
			<dl className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
				<MetricSummary
					label="Latest steps"
					value={formatNumber(latestActivity?.steps ?? null)}
					detail={latestActivity?.local_date ?? "No observation"}
				/>
				<MetricSummary
					label="Average sleep"
					value={`${formatNumber(averageSleep, 1)} hr`}
					detail={`${data.sleep.length} recorded nights`}
				/>
				<MetricSummary
					label="Resting heart rate"
					value={`${formatNumber(latestRestingHeartRate)} bpm`}
					detail="Latest daily observation"
				/>
				<MetricSummary
					label="VO₂ max"
					value={formatNumber(latestVo2Max, 1)}
					detail="mL/kg/min · latest estimate"
				/>
			</dl>

			<section aria-labelledby="activity-heading">
				<h2
					id="activity-heading"
					className="font-sans text-2xl font-bold tracking-[-0.03em] text-primary"
				>
					Activity
				</h2>
				<p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-secondary">
					Daily totals use HealthKit’s reconciled samples. Missing days stay empty.
				</p>
				<div className="mt-5 grid gap-x-8 lg:grid-cols-2">
					<TrendChart
						title="Steps"
						description="Daily step count"
						data={data.activity.map((row) => ({ date: row.local_date, value: row.steps }))}
						unit="steps"
						formatValue={(value) => formatNumber(value)}
					/>
					<TrendChart
						title="Active energy"
						description="Daily active energy, converted from stored kilojoules for display"
						data={data.activity.map((row) => ({
							date: row.local_date,
							value: row.active_energy_kj === null ? null : row.active_energy_kj / 4.184,
						}))}
						unit="kcal"
						color="var(--color-health-gold)"
						formatValue={(value) => formatNumber(value)}
					/>
				</div>
			</section>

			<section aria-labelledby="recovery-heading">
				<h2
					id="recovery-heading"
					className="font-sans text-2xl font-bold tracking-[-0.03em] text-primary"
				>
					Recovery
				</h2>
				<p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-secondary">
					Personal trends are more useful here than comparisons with a population cutoff.
				</p>
				<div className="mt-5 grid gap-x-8 lg:grid-cols-2">
					<TrendChart
						title="Resting heart rate"
						description="Daily average of available resting-heart-rate samples"
						data={data.recovery.map((row) => ({
							date: row.local_date,
							value: row.resting_heart_rate,
						}))}
						unit="bpm"
						color="var(--color-health-blue)"
					/>
					<TrendChart
						title="Heart rate variability"
						description="Daily average HRV; measurement context can affect this value"
						data={data.recovery.map((row) => ({ date: row.local_date, value: row.hrv }))}
						unit="ms"
						color="var(--color-health-green)"
					/>
				</div>
				<div className="mt-3 grid gap-x-8 lg:grid-cols-2">
					<SleepChart data={data.sleep} />
					<TrendChart
						title="VO₂ max"
						description="Sparse Apple Health cardiorespiratory-fitness estimates"
						data={data.vo2Max.map((row) => ({ date: row.local_date, value: row.value }))}
						unit="mL/kg/min"
						color="var(--color-health-teal)"
					/>
				</div>
			</section>

			<section aria-labelledby="medical-heading">
				<h2
					id="medical-heading"
					className="font-sans text-2xl font-bold tracking-[-0.03em] text-primary"
				>
					Medical reports
				</h2>
				<p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-secondary">
					Measured report values across available history. These trends and guideline ranges are
					interpretation aids, not diagnoses; use the source report and clinical context for
					decisions.
				</p>
				<div className="mt-5 grid gap-x-8 lg:grid-cols-3">
					{Object.entries(medicalDefinitions).map(([code, definition]) => {
						const rows = data.medical.filter((row) => row.metric_code === code);
						return (
							<TrendChart
								key={code}
								title={definition.title}
								description={definition.description}
								data={rows.map((row) => ({
									date: toIndiaDate(row.collected_at_ms),
									value: row.value,
								}))}
								unit={rows[0]?.unit ?? ""}
								color={definition.color}
							/>
						);
					})}
				</div>
			</section>
		</div>
	);
}
