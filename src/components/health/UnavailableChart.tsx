interface UnavailableChartProps {
	title: string;
	description: string;
}

export default function UnavailableChart({ title, description }: UnavailableChartProps) {
	return (
		<figure className="min-w-0 border-t border-tertiary py-5">
			<figcaption className="font-sans text-base font-semibold text-primary">{title}</figcaption>
			<p className="mt-1 max-w-xl font-sans text-xs leading-relaxed text-secondary">
				{description}
			</p>
			<div className="mt-5 flex min-h-40 items-center justify-center border-y border-tertiary px-6 text-center">
				<p className="max-w-xs font-sans text-sm leading-relaxed text-secondary">
					Waiting for source data
				</p>
			</div>
		</figure>
	);
}
