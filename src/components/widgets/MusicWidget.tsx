import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef } from "react";
import type { SongData } from "@/lib/widgetConfig";

const DEG_PER_MS = (33 * 360) / 60000; // 33 RPM in degrees/ms

const VINYL_LABEL_PATH =
	"M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";

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
	const clipId = useId();
	const shouldReduceMotion = useReducedMotion();

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
		<div className="w-75 h-50 shrink-0 relative bg-white rounded-2xl shadow-lg flex flex-col justify-end">
			{/* iOS chat bubble — anchored top-left, overflows container */}
			{songData.message && (
				<div className="absolute -left-25 -top-5 z-30">
					<div className="chat-bubble-tail relative bg-[#0b93f6] text-white font-sans text-[13px] leading-4.5 rounded-2xl px-4 py-2 max-w-50">
						{songData.message}
					</div>
				</div>
			)}

			{/* Song info text — flex-pushed to bottom */}
			<div className="flex flex-col pl-6 pb-6">
				<span className="font-sans font-bold text-[12px] text-[#7f964c] tracking-[-0.3px] uppercase pb-2">
					{songData.label}
				</span>
				<span className="font-sans font-bold text-[24px] tracking-[-0.4px] text-black leading-none pb-1">
					{songData.artist}
				</span>
				<span className="font-sans font-normal text-[20px] tracking-[-0.48px] text-gray-400">
					{songData.title}
				</span>
			</div>

			{/* Record player assembly */}
			<div ref={recordRef} className="absolute left-35 top-[-65px] w-55 h-55">
				{/* Static shadow — decoupled from animation to avoid per-frame filter recomputation */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="w-[158px] h-[158px] rounded-full shadow-[0_8px_12px_rgba(0,0,0,0.35)]" />
				</div>
				{/* Spinning/scratchable record + album art — circular hit area */}
				<motion.div
					className="relative w-full h-full cursor-grab active:cursor-grabbing [clip-path:circle(36%)] touch-action-none"
					style={{ rotate: rotation }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
				>
					<img src="/record content.png" alt="" className="w-full h-full" draggable={false} />
					{/* Album art — inline SVG with donut clip */}
					<svg
						viewBox="0 0 59 59"
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[82px] h-[82px]"
						xmlns="http://www.w3.org/2000/svg"
						role="img"
						aria-label="Album art"
					>
						<defs>
							<clipPath id={clipId}>
								<path d={VINYL_LABEL_PATH} />
							</clipPath>
						</defs>
						<image
							href={songData.albumArt}
							x="0"
							y="0"
							width="59"
							height="59"
							preserveAspectRatio="xMidYMid slice"
							clipPath={`url(#${clipId})`}
						/>
					</svg>
				</motion.div>

				{/* Specular highlight — static overlay */}
				<img
					src="/specular highlight.svg"
					alt=""
					className="absolute left-[35px] top-[31px] w-20 mix-blend-color-dodge pointer-events-none"
					draggable={false}
				/>

				{/* Tonearm — static */}
				<img
					src="/tonearm.png"
					alt=""
					className="absolute -left-12 top-[75px] w-[130px] -rotate-90 origin-[30%_15%] pointer-events-none z-10"
					draggable={false}
				/>
			</div>
		</div>
	);
}
