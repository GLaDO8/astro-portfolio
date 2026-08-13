import { extent, line, scaleLinear, scaleUtc } from "d3";

interface TrendDatum {
	date: string;
	value: number | null;
}

interface TrendChartProps {
	title: string;
	description: string;
	data: TrendDatum[];
	unit: string;
	color?: string;
	formatValue?: (value: number) => string;
}

const WIDTH = 720;
const HEIGHT = 220;
const MARGIN = { top: 18, right: 16, bottom: 30, left: 48 };

const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const defaultFormat = (value: number) =>
	value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function TrendChart({
	title,
	description,
	data,
	unit,
	color = "var(--color-health-warm)",
	formatValue = defaultFormat,
}: TrendChartProps) {
	const points = data.map((datum) => ({ ...datum, instant: parseDate(datum.date) }));
	const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
	const dateExtent = extent(points, (point) => point.instant);
	const valueExtent = extent(values);

	if (
		!dateExtent[0] ||
		!dateExtent[1] ||
		valueExtent[0] === undefined ||
		valueExtent[1] === undefined
	) {
		return (
			<figure className="border-t border-tertiary py-5">
				<figcaption className="font-sans text-base font-semibold text-primary">{title}</figcaption>
				<p className="mt-2 text-sm text-secondary">No observations available.</p>
			</figure>
		);
	}

	const padding = Math.max(
		(valueExtent[1] - valueExtent[0]) * 0.12,
		Math.abs(valueExtent[1]) * 0.02,
		1,
	);
	const x = scaleUtc(dateExtent, [MARGIN.left, WIDTH - MARGIN.right]);
	const y = scaleLinear(
		[valueExtent[0] - padding, valueExtent[1] + padding],
		[HEIGHT - MARGIN.bottom, MARGIN.top],
	);
	const path = line<(typeof points)[number]>()
		.defined((point) => point.value !== null)
		.x((point) => x(point.instant))
		.y((point) => y(point.value ?? 0))(points);
	const xTicks = x.ticks(4);
	const yTicks = y.ticks(4);
	const spansMultipleYears = dateExtent[1].getUTCFullYear() !== dateExtent[0].getUTCFullYear();
	const observed = points.filter(
		(point): point is typeof point & { value: number } => point.value !== null,
	);
	const latest = observed.at(-1);
	const titleId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

	return (
		<figure className="min-w-0 border-t border-tertiary py-5">
			<div className="flex items-baseline justify-between gap-4">
				<figcaption id={titleId} className="font-sans text-base font-semibold text-primary">
					{title}
				</figcaption>
				{latest ? (
					<span className="shrink-0 font-mono text-sm font-semibold text-primary">
						{formatValue(latest.value)} {unit}
					</span>
				) : null}
			</div>
			<p className="mt-1 font-sans text-xs leading-relaxed text-secondary">{description}</p>
			<svg
				className="mt-4 h-auto w-full overflow-visible"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				role="img"
				aria-labelledby={`${titleId} ${titleId}-desc`}
			>
				<title>{title}</title>
				<desc id={`${titleId}-desc`}>
					{observed.length} observations from {points[0]?.date} to {points.at(-1)?.date}. Values
					range from {formatValue(valueExtent[0])} to {formatValue(valueExtent[1])} {unit}. Missing
					dates are not treated as zero.
				</desc>
				{yTicks.map((tick) => (
					<g key={tick}>
						<line
							x1={MARGIN.left}
							x2={WIDTH - MARGIN.right}
							y1={y(tick)}
							y2={y(tick)}
							stroke="var(--color-tertiary)"
							strokeDasharray="3 5"
						/>
						<text
							x={MARGIN.left - 8}
							y={y(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							className="fill-secondary font-mono text-xs"
						>
							{formatValue(tick)}
						</text>
					</g>
				))}
				{xTicks.map((tick) => (
					<text
						key={tick.toISOString()}
						x={x(tick)}
						y={HEIGHT - 8}
						textAnchor="middle"
						className="fill-secondary font-mono text-xs"
					>
						{tick.toLocaleDateString("en", {
							month: "short",
							year: spansMultipleYears ? "2-digit" : undefined,
							timeZone: "UTC",
						})}
					</text>
				))}
				{path ? <path d={path} fill="none" stroke={color} strokeWidth="2.5" /> : null}
				{observed.length <= 40
					? observed.map((point) => (
							<circle
								key={`${point.date}-${point.value}`}
								cx={x(point.instant)}
								cy={y(point.value)}
								r="3.5"
								fill={color}
							/>
						))
					: null}
			</svg>
		</figure>
	);
}
