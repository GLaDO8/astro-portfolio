import { useCallback, useEffect, useState } from "react";
import {
	getSpringConfigDefaults,
	resetSpringConfigs,
	type SpringConfig,
	type SpringConfigMap,
	updateSpringConfig,
	useAllSpringConfigs,
} from "@/lib/spring-config";

const LABELS: Record<keyof SpringConfigMap, string> = {
	photoFrameTilt: "Photo Frame Tilt",
	polaroidFan: "Polaroid Fan",
};

const RANGES = {
	stiffness: { min: 10, max: 500, step: 5 },
	damping: { min: 1, max: 50, step: 1 },
	mass: { min: 0.1, max: 10, step: 0.1 },
} as const;

function SpringSliderGroup({
	label,
	configKey,
	config,
	defaultConfig,
}: {
	label: string;
	configKey: keyof SpringConfigMap;
	config: SpringConfig;
	defaultConfig: SpringConfig;
}) {
	const handleChange = useCallback(
		(prop: keyof SpringConfig, value: number) => {
			updateSpringConfig(configKey, { [prop]: value });
		},
		[configKey],
	);

	return (
		<div className="flex flex-col gap-1.5">
			<span className="font-inter font-semibold text-[11px] tracking-[0.05em] uppercase text-white/70">
				{label}
			</span>
			{(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((prop) => {
				const range = RANGES[prop];
				const isChanged = config[prop] !== defaultConfig[prop];
				return (
					<label key={prop} className="flex items-center gap-2">
						<span
							className={`font-inter text-[11px] w-[62px] shrink-0 ${isChanged ? "text-amber-300" : "text-white/50"}`}
						>
							{prop}
						</span>
						<input
							type="range"
							min={range.min}
							max={range.max}
							step={range.step}
							value={config[prop]}
							onChange={(e) =>
								handleChange(prop, Number.parseFloat(e.target.value))
							}
							className="flex-1 h-1 accent-white/80"
						/>
						<span
							className={`font-inter text-[11px] w-[32px] text-right tabular-nums ${isChanged ? "text-amber-300" : "text-white/50"}`}
						>
							{config[prop] % 1 === 0 ? config[prop] : config[prop].toFixed(1)}
						</span>
					</label>
				);
			})}
		</div>
	);
}

export default function DebugOverlay() {
	const [open, setOpen] = useState(false);
	const configs = useAllSpringConfigs();
	const defaults = getSpringConfigDefaults();

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, []);

	if (!open) return null;

	return (
		<div className="fixed top-4 right-4 z-[9999] w-[260px] bg-black/85 backdrop-blur-md rounded-xl p-4 flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10">
			<div className="flex items-center justify-between">
				<span className="font-inter font-bold text-[12px] tracking-[0.08em] uppercase text-white/90">
					Spring Tuner
				</span>
				<button
					type="button"
					onClick={resetSpringConfigs}
					className="font-inter text-[10px] text-white/40 hover:text-white/80 transition-colors uppercase tracking-wider cursor-pointer"
				>
					Reset
				</button>
			</div>

			{(Object.keys(LABELS) as (keyof SpringConfigMap)[]).map((key) => (
				<SpringSliderGroup
					key={key}
					label={LABELS[key]}
					configKey={key}
					config={configs[key]}
					defaultConfig={defaults[key]}
				/>
			))}

			<span className="font-inter text-[9px] text-white/25 text-center">
				{"\u2318"}D to toggle
			</span>
		</div>
	);
}
