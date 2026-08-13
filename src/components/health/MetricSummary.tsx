interface MetricSummaryProps {
	label: string;
	value: string;
	detail: string;
}

export default function MetricSummary({ label, value, detail }: MetricSummaryProps) {
	return (
		<div className="border-t border-tertiary pt-3">
			<dt className="font-sans text-sm font-medium text-secondary">{label}</dt>
			<dd className="mt-2 font-mono text-2xl font-semibold tracking-[-0.04em] text-primary">
				{value}
			</dd>
			<p className="mt-1 font-sans text-xs leading-relaxed text-secondary">{detail}</p>
		</div>
	);
}
