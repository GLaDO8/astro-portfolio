import { useEffect, useState } from "react";
import {
	getAppleHealthDataRange,
	getLatestMedicalDate,
	rollUpWeeklyExerciseTime,
	toIndiaDate,
} from "./healthData";
import MetricSummary from "./MetricSummary";
import { type MedicalMetricCode, medicalDefinitions, medicalSections } from "./medicalMetrics";
import SleepChart from "./SleepChart";
import TrendChart from "./TrendChart";
import UnavailableChart from "./UnavailableChart";

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
	metric_code: MedicalMetricCode;
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
	weight: { local_date: string; value: number }[];
}

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

const displayDate = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

const formatDisplayDate = (date: string) => displayDate.format(new Date(`${date}T00:00:00Z`));

function HealthHeader({ data, hasError }: { data: HealthData | null; hasError?: boolean }) {
	const appleHealthRange = data ? getAppleHealthDataRange(data) : null;
	const latestMedicalDate = data ? getLatestMedicalDate(data.medical) : null;
	const fallbackLabel = hasError ? "Unavailable" : data ? "No observations" : "Reading D1…";
	const appleHealthLabel = appleHealthRange
		? appleHealthRange.firstDate === appleHealthRange.lastDate
			? formatDisplayDate(appleHealthRange.firstDate)
			: `${formatDisplayDate(appleHealthRange.firstDate)} – ${formatDisplayDate(appleHealthRange.lastDate)}`
		: fallbackLabel;
	const medicalLabel = latestMedicalDate ? formatDisplayDate(latestMedicalDate) : fallbackLabel;

	return (
		<header>
			<p className="font-mono text-xs font-semibold tracking-[0.12em] text-secondary uppercase">
				Local development · private health data
			</p>
			<h1 className="mt-4 max-w-4xl font-sans text-4xl leading-[1.05] font-bold tracking-[-0.04em] text-primary md:text-6xl">
				Health, in context
			</h1>
			<p className="mt-5 max-w-2xl font-sans text-base leading-relaxed text-secondary md:text-lg">
				A first view of daily activity, recovery, sleep, fitness, and selected medical-report trends
				from D1. This route and its data bridge exist only while the Astro development server is
				running.
			</p>
			<div
				className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-secondary"
				aria-live="polite"
			>
				<p>Apple Health · {appleHealthLabel}</p>
				<p>Last blood test · {medicalLabel}</p>
			</div>
		</header>
	);
}

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
		return (
			<div className="space-y-10">
				<HealthHeader data={null} hasError />
				<p className="border-y border-tertiary py-8 font-sans text-sm text-primary">{error}</p>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="space-y-10">
				<HealthHeader data={null} />
				<p className="border-y border-tertiary py-8 font-sans text-sm text-secondary" role="status">
					Reading selected metrics from D1…
				</p>
			</div>
		);
	}

	const latestActivity = data.activity.at(-1);
	const averageSleep = average(data.sleep.map((row) => row.total_sleep_hours));
	const latestRestingHeartRate = latest(data.recovery.map((row) => row.resting_heart_rate));
	const latestVo2Max = data.vo2Max.at(-1)?.value ?? null;
	const weeklyExerciseTime = rollUpWeeklyExerciseTime(data.activity);

	const medicalChart = (code: MedicalMetricCode) => {
		const definition = medicalDefinitions[code];
		const rows = data.medical.filter((row) => row.metric_code === code);
		return (
			<TrendChart
				key={code}
				title={definition.title}
				description={definition.description}
				data={rows.map((row) => ({
					date: toIndiaDate(row.collected_at_ms),
					value: row.value,
					qualifier: row.qualifier,
				}))}
				unit={rows[0]?.unit ?? ""}
				color={definition.color}
			/>
		);
	};

	return (
		<div className="space-y-10">
			<HealthHeader data={data} />
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
							title="Weekly Apple Exercise Time"
							description="Weekly total of Apple Exercise Time, grouped into Monday-starting weeks"
							data={weeklyExerciseTime}
							unit="min"
							color="var(--color-health-green)"
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
					<div className="mt-3 grid gap-x-8 lg:grid-cols-2">
						<TrendChart
							title="Weight"
							description="Recorded body-mass observations; days without a measurement remain empty"
							data={data.weight.map((row) => ({ date: row.local_date, value: row.value }))}
							unit="kg"
							color="var(--color-health-blue)"
							formatValue={(value) => formatNumber(value, 1)}
						/>
						<UnavailableChart
							title="Pace Curve"
							description="A reliable pace curve needs workout-level time and distance samples, which are not yet transformed into D1."
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
					{medicalSections.map((section) => (
						<div key={section.title}>
							<h3 className="mt-8 font-sans text-lg font-semibold text-primary">{section.title}</h3>
							{section.groups.map((group) => (
								<div key={group.codes[0]}>
									{"title" in group && group.title ? (
										<h4 className="mt-5 font-sans text-sm font-semibold text-secondary">
											{group.title}
										</h4>
									) : null}
									<div className="mt-3 grid gap-x-8 lg:grid-cols-3">
										{group.codes.map(medicalChart)}
									</div>
								</div>
							))}
						</div>
					))}
				</section>
			</div>
		</div>
	);
}
