import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import type { SongData } from "@/lib/widgetConfig";

const DEG_PER_MS = (33 * 360) / 60000; // 33 RPM in degrees/ms
const SLEEVE_TEXTURE = "/sleeve.png";
const SLEEVE_MASK_STYLE = {
	WebkitMaskImage: `url(${SLEEVE_TEXTURE})`,
	maskImage: `url(${SLEEVE_TEXTURE})`,
	WebkitMaskPosition: "center",
	maskPosition: "center",
	WebkitMaskRepeat: "no-repeat",
	maskRepeat: "no-repeat",
	WebkitMaskSize: "100% 100%",
	maskSize: "100% 100%",
};

interface Props {
	songData: SongData;
}

export default function MusicWidget({ songData }: Props) {
	const rotation = useMotionValue(0);
	const isScratching = useRef(false);
	const isVisible = useRef(true);
	const lastAngle = useRef(0);
	const cachedRect = useRef<DOMRect | null>(null);
	const recordRef = useRef<HTMLDivElement>(null);
	const shouldReduceMotion = useReducedMotion();
	const albumArt = songData.albumArt || "/vinyl-album-art.svg";

	useEffect(() => {
		if (!recordRef.current) return;
		const obs = new IntersectionObserver(([entry]) => {
			isVisible.current = entry.isIntersecting;
		});
		obs.observe(recordRef.current);
		return () => obs.disconnect();
	}, []);

	// Auto-rotate at 33 RPM when not scratching and visible
	useAnimationFrame((_, delta) => {
		if (shouldReduceMotion) return;
		if (!isScratching.current && isVisible.current) {
			rotation.set((rotation.get() + DEG_PER_MS * delta) % 360);
		}
	});

	const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
		const rect = cachedRect.current;
		if (!rect) return 0;
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
	}, []);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			if (recordRef.current) {
				cachedRect.current = recordRef.current.getBoundingClientRect();
			}
			isScratching.current = true;
			lastAngle.current = getAngleFromCenter(e.clientX, e.clientY);
		},
		[getAngleFromCenter],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isScratching.current) return;
			const angle = getAngleFromCenter(e.clientX, e.clientY);
			let delta = angle - lastAngle.current;
			if (delta > 180) delta -= 360;
			if (delta < -180) delta += 360;
			rotation.set(rotation.get() + delta);
			lastAngle.current = angle;
		},
		[getAngleFromCenter, rotation],
	);

	const handlePointerUp = useCallback(() => {
		isScratching.current = false;
	}, []);

	return (
		<div className="relative h-[9.5rem] w-[10.5rem] shrink-0">
			<div
				aria-hidden="true"
				className="absolute left-[4.2rem] top-0 flex h-4 items-center gap-0.5 rounded-full bg-mist px-2 text-charcoal/50"
			>
				<span className="h-2 w-0.5 rounded-full bg-current" />
				<span className="h-2.5 w-0.5 rounded-full bg-current" />
				<span className="h-1.5 w-0.5 rounded-full bg-current" />
				<span className="h-3 w-0.5 rounded-full bg-current" />
				<span className="h-2 w-0.5 rounded-full bg-current" />
			</div>

			<div ref={recordRef} className="absolute left-3 top-4 h-[7rem] w-[8.8rem]">
				<div className="absolute left-12 top-3 size-[5.7rem] rounded-full bg-neutral-950 shadow-[0_4px_16px_rgba(0,0,0,0.24)]" />
				<motion.div
					className="absolute left-[3.2rem] top-2 size-[6rem] cursor-grab rounded-full active:cursor-grabbing [clip-path:circle(50%)] touch-action-none"
					style={{ rotate: rotation }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
				>
					<img src="/record content.png" alt="" className="h-full w-full" draggable={false} />
				</motion.div>
				<div className="absolute left-0 top-1 h-[6.8rem] w-[6.8rem] rotate-[-3deg] [isolation:isolate] drop-shadow-[0_10px_18px_rgba(42,35,29,0.18)]">
					<img
						src={albumArt}
						alt=""
						className="absolute top-1/2 left-1/2 z-0 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-cover"
						style={SLEEVE_MASK_STYLE}
						draggable={false}
					/>
					<img
						src={SLEEVE_TEXTURE}
						alt=""
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover mix-blend-lighten"
						draggable={false}
					/>
					<img
						src={SLEEVE_TEXTURE}
						alt=""
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover mix-blend-exclusion"
						draggable={false}
					/>
				</div>
			</div>

			<div className="absolute bottom-0 left-5 flex rotate-[-4deg] items-baseline gap-1 font-sans">
				<span className="text-sm font-semibold tracking-[-0.02em] text-charcoal">
					{songData.artist || "Now playing"}
				</span>
				<span className="text-sm font-medium tracking-[-0.02em] text-charcoal/70">#3</span>
			</div>
		</div>
	);
}
