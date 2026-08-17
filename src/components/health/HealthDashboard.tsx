import { useEffect, useState } from "react";
import {
	formatClockHour,
	getAbsoluteVo2Max,
	getAppleHealthDataRange,
	getLatestMedicalDate,
	getSleepRegularity,
	toIndiaDate,
} from "./healthData";
import MetricSummary from "./MetricSummary";
import { type MedicalMetricCode, medicalDefinitions, medicalSections } from "./medicalMetrics";
import { medicalReferenceRanges } from "./medicalReferenceRanges";
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
	sleep_start_ms: number | null;
	sleep_end_ms: number | null;
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
	bodyFat: { local_date: string; value: number }[];
	summaries: Record<string, { local_date: string; value: number }>;
	coverage: { firstDate: string | null; lastDate: string | null };
	aggregation: {
		version: number;
		grains: Record<string, "day" | "week" | "month">;
	};
}

const average = (values: Array<number | null>) => {
	const observed = values.filter((value): value is number => value !== null);
	return observed.length > 0
		? observed.reduce((total, value) => total + value, 0) / observed.length
		: null;
};

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
				A first view of weekly activity and recovery, daily observations, sleep, fitness, and
				selected medical-report trends from D1. This route and its data bridge exist only while the
				Astro development server is running.
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
					const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
					throw new Error(
						payload?.error === "health_rollup_backfill_required" ? "backfill" : "local",
					);
				}
				return response.json() as Promise<HealthData>;
			})
			.then(setData)
			.catch((requestError: unknown) => {
				if (requestError instanceof DOMException && requestError.name === "AbortError") {
					return;
				}
				setError(
					requestError instanceof Error && requestError.message === "backfill"
						? "Health rollups are not ready. Run pnpm health:rollups:backfill:local, then reload."
						: "Could not read local D1. Run pnpm health:db:bootstrap:local, import the reviewed JSON, and reload.",
				);
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

	const latestSteps = data.summaries.step_count;
	const averageSleep = average(data.sleep.map((row) => row.total_sleep_hours));
	const latestRestingHeartRate = data.summaries.resting_heart_rate;
	const latestVo2Max = data.vo2Max.at(-1)?.value ?? null;
	const absoluteVo2Max = getAbsoluteVo2Max(data.vo2Max, data.weight);
	const sleepRegularity = getSleepRegularity(data.sleep).slice(27);

	const medicalChart = (code: MedicalMetricCode) => {
		const definition = medicalDefinitions[code];
		const referenceRange = medicalReferenceRanges[code];
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
				referenceRange={rows[0]?.unit === referenceRange.unit ? referenceRange : undefined}
			/>
		);
	};

	return (
		<div className="space-y-10">
			<HealthHeader data={data} />
			<div className="space-y-14">
				<dl className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
					<MetricSummary
						label="Latest daily steps"
						value={formatNumber(latestSteps?.value ?? null)}
						detail={latestSteps?.local_date ?? "No observation"}
					/>
					<MetricSummary
						label="Average sleep"
						value={`${formatNumber(averageSleep, 1)} hr`}
						detail={`${data.sleep.length} recorded nights`}
					/>
					<MetricSummary
						label="Resting heart rate"
						value={`${formatNumber(latestRestingHeartRate?.value ?? null)} bpm`}
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
						Weekly totals use HealthKit’s reconciled samples. Only complete Monday-starting weeks
						are shown; missing weeks stay empty.
					</p>
					<div className="mt-5 grid gap-x-8 lg:grid-cols-2">
						<TrendChart
							title="Steps"
							description="Step total for each complete Monday-starting week"
							data={data.activity.map((row) => ({ date: row.local_date, value: row.steps }))}
							unit="steps"
							intervalDays={7}
							formatValue={(value) => formatNumber(value)}
						/>
						<TrendChart
							title="Weekly Apple Exercise Time"
							description="Weekly total of Apple Exercise Time, grouped into Monday-starting weeks"
							data={data.activity.map((row) => ({
								date: row.local_date,
								value: row.exercise_minutes,
							}))}
							unit="min"
							intervalDays={7}
							color="var(--color-health-green)"
							formatValue={(value) => formatNumber(value)}
						/>
						<TrendChart
							title="Active energy"
							description="Weekly active energy, converted from stored kilojoules for display"
							data={data.activity.map((row) => ({
								date: row.local_date,
								value: row.active_energy_kj === null ? null : row.active_energy_kj / 4.184,
							}))}
							unit="kcal"
							intervalDays={7}
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
							intervalDays={1}
							color="var(--color-health-blue)"
							formatValue={(value) => formatNumber(value, 1)}
						/>
						<TrendChart
							title="Body Fat"
							description="Recorded body-fat estimates; measurement method and conditions can affect comparability"
							data={data.bodyFat.map((row) => ({ date: row.local_date, value: row.value }))}
							unit="%"
							intervalDays={1}
							color="var(--color-health-teal)"
							formatValue={(value) => formatNumber(value, 1)}
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
							description="Weighted average across each complete Monday-starting week"
							data={data.recovery.map((row) => ({
								date: row.local_date,
								value: row.resting_heart_rate,
							}))}
							unit="bpm"
							intervalDays={7}
							color="var(--color-health-blue)"
						/>
						<TrendChart
							title="Heart rate variability"
							description="Weighted weekly average HRV; measurement context can affect this value"
							data={data.recovery.map((row) => ({ date: row.local_date, value: row.hrv }))}
							unit="ms"
							intervalDays={7}
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
							intervalDays={1}
							color="var(--color-health-teal)"
						/>
						<TrendChart
							title="Absolute VO₂"
							description="Derived oxygen use from each relative VO₂ estimate and the latest body weight recorded on or before that day"
							data={absoluteVo2Max}
							unit="mL/min"
							intervalDays={1}
							color="var(--color-health-gold)"
							formatValue={(value) => formatNumber(value)}
						/>
					</div>
					<h3 className="mt-8 font-sans text-lg font-semibold text-primary">Sleep Regularity</h3>
					<p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-secondary">
						Clock timing is anchored to India time. Variability is the population standard deviation
						over the latest 28 recorded nights; lower means more regular, not necessarily better
						sleep.
					</p>
					<div className="mt-3 grid gap-x-8 lg:grid-cols-2">
						<TrendChart
							title="Sleep Midpoint"
							description="Midpoint between recorded sleep start and end"
							data={sleepRegularity.map((row) => ({ date: row.date, value: row.midpointHour }))}
							unit=""
							intervalDays={1}
							color="var(--color-health-sleep-deep)"
							formatValue={formatClockHour}
						/>
						<TrendChart
							title="Sleep Onset Variability"
							description="Rolling variability in recorded sleep start time"
							data={sleepRegularity.map((row) => ({
								date: row.date,
								value: row.onsetVariabilityMinutes,
							}))}
							unit="min"
							intervalDays={1}
							color="var(--color-health-sleep-core)"
						/>
						<TrendChart
							title="Wake-Time Variability"
							description="Rolling variability in recorded sleep end time"
							data={sleepRegularity.map((row) => ({
								date: row.date,
								value: row.wakeVariabilityMinutes,
							}))}
							unit="min"
							intervalDays={1}
							color="var(--color-health-sleep-rem)"
						/>
						<TrendChart
							title="Sleep Midpoint Variability"
							description="Rolling variability in the midpoint of each sleep window"
							data={sleepRegularity.map((row) => ({
								date: row.date,
								value: row.midpointVariabilityMinutes,
							}))}
							unit="min"
							intervalDays={1}
							color="var(--color-health-sleep-deep)"
						/>
						<TrendChart
							title="Sleep Duration Variability"
							description="Rolling variability in recorded total sleep duration"
							data={sleepRegularity.map((row) => ({
								date: row.date,
								value: row.durationVariabilityMinutes,
							}))}
							unit="min"
							intervalDays={1}
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
