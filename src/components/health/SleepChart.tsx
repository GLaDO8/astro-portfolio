import { scaleBand, scaleLinear } from "d3";

interface SleepDatum {
	local_date: string;
	total_sleep_hours: number | null;
	awake_hours: number | null;
	core_hours: number | null;
	deep_hours: number | null;
	rem_hours: number | null;
}

const WIDTH = 720;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 16, bottom: 30, left: 40 };
const stages = [
	{ key: "core_hours", label: "Core", color: "var(--color-health-sleep-core)" },
	{ key: "deep_hours", label: "Deep", color: "var(--color-health-sleep-deep)" },
	{ key: "rem_hours", label: "REM", color: "var(--color-health-sleep-rem)" },
] as const;

export default function SleepChart({ data }: { data: SleepDatum[] }) {
	const complete = data.filter((row) => stages.every((stage) => row[stage.key] !== null));
	const maxHours = Math.max(
		10,
		...complete.map((row) => stages.reduce((total, stage) => total + (row[stage.key] ?? 0), 0)),
	);
	const x = scaleBand(
		complete.map((row) => row.local_date),
		[MARGIN.left, WIDTH - MARGIN.right],
	).padding(0.18);
	const y = scaleLinear([0, maxHours], [HEIGHT - MARGIN.bottom, MARGIN.top]);
	const titleId = "sleep-stages-chart";

	return (
		<figure className="min-w-0 border-t border-tertiary py-5">
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<figcaption id={titleId} className="font-sans text-base font-semibold text-primary">
					Sleep stages
				</figcaption>
				<div className="flex gap-3 font-sans text-xs text-secondary" aria-hidden="true">
					{stages.map((stage) => (
						<span key={stage.key} className="flex items-center gap-1.5">
							<span className="size-2 rounded-full" style={{ background: stage.color }} />
							{stage.label}
						</span>
					))}
				</div>
			</div>
			<p className="mt-1 font-sans text-xs leading-relaxed text-secondary">
				Nightly stage duration. Days without a complete stage breakdown are omitted, not counted as
				zero.
			</p>
			<svg
				className="mt-4 h-auto w-full"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				role="img"
				aria-labelledby={`${titleId} ${titleId}-desc`}
			>
				<title>Sleep stages by night</title>
				<desc id={`${titleId}-desc`}>
					Stacked bars for core, deep, and REM sleep across {complete.length} nights.
				</desc>
				{y.ticks(5).map((tick) => (
					<g key={tick}>
						<line
							x1={MARGIN.left}
							x2={WIDTH - MARGIN.right}
							y1={y(tick)}
							y2={y(tick)}
							stroke="var(--color-tertiary)"
						/>
						<text
							x={MARGIN.left - 7}
							y={y(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							className="fill-secondary font-mono text-xs"
						>
							{tick}h
						</text>
					</g>
				))}
				{complete.map((row) => {
					let offset = 0;
					return stages.map((stage) => {
						const value = row[stage.key] ?? 0;
						const top = offset + value;
						const rect = (
							<rect
								key={`${row.local_date}-${stage.key}`}
								x={x(row.local_date)}
								y={y(top)}
								width={x.bandwidth()}
								height={Math.max(0, y(offset) - y(top))}
								fill={stage.color}
							/>
						);
						offset = top;
						return rect;
					});
				})}
				{complete.length > 0
					? [complete[0], complete.at(-1)].map((row) =>
							row ? (
								<text
									key={row.local_date}
									x={(x(row.local_date) ?? 0) + x.bandwidth() / 2}
									y={HEIGHT - 8}
									textAnchor="middle"
									className="fill-secondary font-mono text-xs"
								>
									{new Date(`${row.local_date}T00:00:00Z`).toLocaleDateString("en", {
										month: "short",
										day: "numeric",
										timeZone: "UTC",
									})}
								</text>
							) : null,
						)
					: null}
			</svg>
		</figure>
	);
}
