import { arc, scaleLinear } from "d3";
import { cn } from "@/lib/cn";
import {
	formatMonthDayYear,
	getDatedValueWindowSummary,
	getTrailingWeeklyAverages,
} from "./healthData";

interface CurrentWeightWidgetProps {
	data: readonly { local_date: string; value: number }[];
}

const WINDOW_DAYS = 30;
const ARC_CENTER = { x: 150, y: 165 };
const ARC_RADIUS = 150;
const ARC_START = -Math.PI / 6;
const ARC_END = Math.PI / 6;
const arcPath =
	arc()
		.innerRadius(143)
		.outerRadius(157)
		.startAngle(ARC_START)
		.endAngle(ARC_END)
		.cornerRadius(7)() ?? "";

const formatWeight = (value: number) =>
	value.toLocaleString(undefined, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});

function pointOnArc(angle: number) {
	return {
		x: ARC_CENTER.x + Math.sin(angle) * ARC_RADIUS,
		y: ARC_CENTER.y - Math.cos(angle) * ARC_RADIUS,
	};
}

function TrendArrowIcon({ direction }: { direction: "up" | "down" }) {
	return (
		<svg
			className={cn("size-5 shrink-0 text-health-blue", direction === "up" && "rotate-180")}
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" />
			<polyline points="8 12 12 16 16 12" />
			<line x1="12" y1="8" x2="12" y2="16" />
		</svg>
	);
}

export default function CurrentWeightWidget({ data }: CurrentWeightWidgetProps) {
	const summary = getDatedValueWindowSummary(data, WINDOW_DAYS);

	if (summary === null) {
		return (
			<article className="grid min-h-72 min-w-0 place-items-center rounded-md border border-primary/10 bg-white p-5 shadow-sm">
				<div className="text-center">
					<h3 className="font-sans text-base font-semibold text-primary">Weight</h3>
					<p className="mt-2 font-sans text-sm text-secondary">
						Import weight observations to populate this widget.
					</p>
				</div>
			</article>
		);
	}

	const { observations, latest, minValue, maxValue, change } = summary;
	const domainPadding = minValue === maxValue ? 0.5 : 0;
	const weightDomain: [number, number] = [minValue - domainPadding, maxValue + domainPadding];
	const valueAngle = scaleLinear(weightDomain, [ARC_START, ARC_END]).clamp(true);
	const weeklyAverages = getTrailingWeeklyAverages(observations, latest.local_date, 4);
	const latestPoint = pointOnArc(valueAngle(latest.value));
	const arcStartPoint = pointOnArc(ARC_START);
	const arcEndPoint = pointOnArc(ARC_END);
	const trendDirection = change === null || change === 0 ? null : change < 0 ? "down" : "up";
	const changeLabel = change === null ? "—" : `${formatWeight(Math.abs(change))}\u00a0kg`;

	return (
		<article
			className="min-h-72 min-w-0 overflow-hidden rounded-md border border-primary/10 bg-white p-5 shadow-sm"
			aria-labelledby="current-weight-title"
		>
			<h3 id="current-weight-title" className="sr-only">
				Weight
			</h3>
			<time
				className="block text-center font-sans text-base font-medium text-secondary tabular-nums"
				dateTime={latest.local_date}
			>
				{formatMonthDayYear(latest.local_date)}
			</time>
			<p className="mt-2 text-center font-mono text-5xl font-semibold text-primary tabular-nums">
				{formatWeight(latest.value)}
				<span className="text-2xl font-medium text-primary">&nbsp;kg</span>
			</p>

			<svg
				className="mt-4 h-auto w-full"
				viewBox="0 0 300 82"
				role="img"
				aria-labelledby="current-weight-arc-title current-weight-arc-description"
			>
				<title id="current-weight-arc-title">30-day weight range</title>
				<desc id="current-weight-arc-description">
					The observed range is {formatWeight(minValue)} to {formatWeight(maxValue)} kilograms. The
					grey dots show available weekly averages from the oldest week to the newest week. The
					latest value is {formatWeight(latest.value)} kilograms.
				</desc>
				<path
					d={arcPath}
					transform={`translate(${ARC_CENTER.x} ${ARC_CENTER.y})`}
					fill="var(--color-tertiary)"
					opacity="0.55"
				/>
				{weeklyAverages.map((average) => {
					const point = pointOnArc(valueAngle(average.value));
					return (
						<circle
							key={average.week}
							cx={point.x}
							cy={point.y}
							r="4"
							fill="var(--color-secondary)"
							opacity={0.3 + (average.week - 1) * 0.15}
						>
							<title>
								Week {average.week} average: {formatWeight(average.value)} kg from{" "}
								{average.observationCount} observations
							</title>
						</circle>
					);
				})}
				<circle
					cx={latestPoint.x}
					cy={latestPoint.y}
					r="8"
					fill="var(--color-primary)"
					stroke="white"
					strokeWidth="3"
				>
					<title>
						Latest: {formatWeight(latest.value)} kg on {latest.local_date}
					</title>
				</circle>
				<text
					x={arcStartPoint.x}
					y="74"
					textAnchor="middle"
					className="fill-secondary font-mono text-sm tabular-nums"
				>
					{formatWeight(minValue)}
				</text>
				<text
					x={arcEndPoint.x}
					y="74"
					textAnchor="middle"
					className="fill-secondary font-mono text-sm tabular-nums"
				>
					{formatWeight(maxValue)}
				</text>
			</svg>

			<div className="mt-2 text-center">
				<p className="flex items-center justify-center gap-2 font-mono text-xl font-semibold text-primary tabular-nums">
					{trendDirection ? <TrendArrowIcon direction={trendDirection} /> : null}
					{changeLabel}
				</p>
				<p className="mt-1 font-sans text-xs font-medium text-secondary uppercase">
					{WINDOW_DAYS} days
				</p>
			</div>
		</article>
	);
}
