import { extent, line, scaleLinear, scaleUtc } from "d3";
import type { ReferenceBand, ReferenceBandTone } from "./medicalReferenceRanges";

interface TrendDatum {
	date: string;
	value: number | null;
	qualifier?: string | null;
}

interface TrendChartProps {
	title: string;
	description: string;
	data: TrendDatum[];
	unit: string;
	color?: string;
	formatValue?: (value: number) => string;
	intervalDays?: number;
	referenceRange?: {
		summary: string;
		bands: readonly ReferenceBand[];
	};
}

const WIDTH = 720;
const HEIGHT = 220;
const MARGIN = { top: 18, right: 16, bottom: 30, left: 48 };

const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const defaultFormat = (value: number) =>
	value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const bandColors: Record<ReferenceBandTone, string> = {
	low: "var(--color-health-blue)",
	reference: "var(--color-health-green)",
	caution: "var(--color-health-gold)",
	high: "var(--color-health-warm)",
};

export default function TrendChart({
	title,
	description,
	data,
	unit,
	color = "var(--color-health-warm)",
	formatValue = defaultFormat,
	intervalDays,
	referenceRange,
}: TrendChartProps) {
	const points = data.map((datum) => ({ ...datum, instant: parseDate(datum.date) }));
	const linePoints = points.flatMap((point, index) => {
		const previous = points[index - 1];
		if (
			intervalDays === undefined ||
			!previous ||
			point.instant.getTime() - previous.instant.getTime() <= intervalDays * 1.5 * 86_400_000
		) {
			return [point];
		}
		return [
			{
				date: "gap",
				value: null,
				qualifier: null,
				instant: new Date((previous.instant.getTime() + point.instant.getTime()) / 2),
			},
			point,
		];
	});
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

	const referenceBoundaries =
		referenceRange?.bands
			.flatMap((band) => [band.min, band.max])
			.filter((value) => value !== undefined) ?? [];
	const domainValues = [...values, ...referenceBoundaries];
	const domainExtent = extent(domainValues);
	const padding = Math.max(
		((domainExtent[1] ?? valueExtent[1]) - (domainExtent[0] ?? valueExtent[0])) * 0.06,
		Math.abs(domainExtent[1] ?? valueExtent[1]) * 0.01,
		1,
	);
	const x = scaleUtc(dateExtent, [MARGIN.left, WIDTH - MARGIN.right]);
	const domainMin = (domainExtent[0] ?? valueExtent[0]) - padding;
	const domainMax = (domainExtent[1] ?? valueExtent[1]) + padding;
	const y = scaleLinear([domainMin, domainMax], [HEIGHT - MARGIN.bottom, MARGIN.top]);
	const path = line<(typeof linePoints)[number]>()
		.defined((point) => point.value !== null && point.qualifier == null)
		.x((point) => x(point.instant))
		.y((point) => y(point.value ?? 0))(linePoints);
	const xTicks = x.ticks(4);
	const yTicks = y.ticks(4);
	const spansMultipleYears = dateExtent[1].getUTCFullYear() !== dateExtent[0].getUTCFullYear();
	const observed = points.filter(
		(point): point is typeof point & { value: number } => point.value !== null,
	);
	const qualifiedCount = observed.filter((point) => point.qualifier != null).length;
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
						{latest.qualifier ?? ""}
						{formatValue(latest.value)} {unit}
					</span>
				) : null}
			</div>
			<p className="mt-1 font-sans text-xs leading-relaxed text-secondary">{description}</p>
			{referenceRange ? (
				<p className="mt-1 font-sans text-xs leading-relaxed text-secondary">
					Reference bands · {referenceRange.summary}
				</p>
			) : null}
			<svg
				className="mt-4 h-auto w-full overflow-visible"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				role="img"
				aria-labelledby={`${titleId} ${titleId}-desc`}
			>
				<title>{title}</title>
				<desc id={`${titleId}-desc`}>
					{observed.length} observations from {points[0]?.date} to {points.at(-1)?.date}. Reported
					numeric values range from {formatValue(valueExtent[0])} to {formatValue(valueExtent[1])}{" "}
					{unit}. Missing dates are not treated as zero.
					{qualifiedCount > 0
						? ` ${qualifiedCount} reported ${qualifiedCount === 1 ? "limit is" : "limits are"} shown at the assay boundary rather than as exact points.`
						: ""}
					{referenceRange ? ` Generalized chart bands: ${referenceRange.summary}.` : ""}
				</desc>
				{referenceRange?.bands.map((band) => {
					const lower = Math.max(domainMin, band.min ?? domainMin);
					const upper = Math.min(domainMax, band.max ?? domainMax);
					return (
						<rect
							key={`${band.label}-${band.min ?? "min"}-${band.max ?? "max"}`}
							x={MARGIN.left}
							y={y(upper)}
							width={WIDTH - MARGIN.left - MARGIN.right}
							height={Math.max(0, y(lower) - y(upper))}
							fill={bandColors[band.tone]}
							opacity="0.1"
						/>
					);
				})}
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
				{observed.length <= 40 || intervalDays !== undefined
					? observed.map((point) =>
							point.qualifier ? (
								<g key={`${point.date}-${point.qualifier}-${point.value}`}>
									<title>
										{point.date}: {point.qualifier}
										{formatValue(point.value)} {unit}
									</title>
									<text
										x={x(point.instant)}
										y={y(point.value)}
										textAnchor="middle"
										dominantBaseline="middle"
										fill={color}
										className="font-mono text-base font-bold"
									>
										{point.qualifier}
									</text>
								</g>
							) : (
								<circle
									key={`${point.date}-${point.value}`}
									cx={x(point.instant)}
									cy={y(point.value)}
									r="3.5"
									fill={color}
								>
									<title>
										{point.date}: {formatValue(point.value)} {unit}
									</title>
								</circle>
							),
						)
					: null}
			</svg>
		</figure>
	);
}
