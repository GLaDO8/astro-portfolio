import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SongData } from "@/lib/widgetConfig";
import pauseIconSvg from "../../assets/widgets/pause.svg?raw";
import playIconSvg from "../../assets/widgets/play.svg?raw";

const PLAY_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(playIconSvg)}`;
const PAUSE_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(pauseIconSvg)}`;
const VINYL_LABEL_CLIP_ID = "music-widget-vinyl-label";
const ARTIST_STRIP_GAP_PX = 24;
const VINYL_LABEL_PATH =
	"M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";

function getElementRotation(element: HTMLElement) {
	const transform = getComputedStyle(element).transform;
	if (!transform || transform === "none") return 0;

	const matrix = new DOMMatrixReadOnly(transform);
	return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

interface Props {
	songData: SongData;
}

interface ArtistNameStripProps {
	artistName: string;
	shouldReduceMotion: boolean | null;
}

function ArtistNameStrip({ artistName, shouldReduceMotion }: ArtistNameStripProps) {
	const viewportRef = useRef<HTMLParagraphElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const [stripDistance, setStripDistance] = useState(0);

	useEffect(() => {
		const viewport = viewportRef.current;
		const text = textRef.current;
		if (!viewport || !text) return;

		const measureOverflow = () => {
			const textWidth = text.scrollWidth;
			const nextStripDistance =
				textWidth - viewport.clientWidth > 1 ? textWidth + ARTIST_STRIP_GAP_PX : 0;
			setStripDistance(nextStripDistance);
		};

		measureOverflow();

		const resizeObserver = new ResizeObserver(measureOverflow);
		resizeObserver.observe(viewport);
		resizeObserver.observe(text);
		window.addEventListener("load", measureOverflow);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("load", measureOverflow);
		};
	}, []);

	const shouldAnimate = stripDistance > 0 && !shouldReduceMotion;

	return (
		<div className="absolute bottom-3 left-1 z-40 w-36 rotate-[-2deg]">
			<p
				ref={viewportRef}
				className={cn(
					"overflow-hidden py-0.5 font-sans text-sm leading-tight font-semibold text-charcoal",
					shouldAnimate &&
						"[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]",
				)}
				title={artistName}
			>
				<motion.span
					className={cn(
						"whitespace-nowrap",
						shouldAnimate ? "inline-flex w-max text-left" : "block w-full",
					)}
					style={shouldAnimate ? { gap: ARTIST_STRIP_GAP_PX } : undefined}
					animate={shouldAnimate ? { x: [0, -stripDistance] } : { x: 0 }}
					transition={
						shouldAnimate
							? {
									duration: Math.max(7, stripDistance / 22),
									ease: "linear",
									repeat: Infinity,
								}
							: undefined
					}
				>
					<span ref={textRef} className={shouldAnimate ? "shrink-0" : "block truncate text-center"}>
						{artistName}
					</span>
					{shouldAnimate ? (
						<span aria-hidden="true" className="shrink-0">
							{artistName}
						</span>
					) : null}
				</motion.span>
			</p>
		</div>
	);
}

export default function MusicWidget({ songData }: Props) {
	const isScratching = useRef(false);
	const [isScratchingRecord, setIsScratchingRecord] = useState(false);
	const [isRecordVisible, setIsRecordVisible] = useState(true);
	const scratchRotation = useRef(0);
	const lastAngle = useRef(0);
	const cachedRect = useRef<DOMRect | null>(null);
	const recordRef = useRef<HTMLDivElement>(null);
	const recordSurfaceRef = useRef<HTMLDivElement>(null);
	const shouldReduceMotion = useReducedMotion();
	const albumArt = songData.albumArt || "/vinyl-album-art.svg";
	const artistName = songData.artist.trim();
	const previewUrl = songData.previewUrl.trim();
	const trackUrl = songData.trackUrl.trim();
	const previewTitle = songData.title || songData.album || artistName || "song";
	const canPlayPreview = Boolean(previewUrl);
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlayingPreview, setIsPlayingPreview] = useState(false);
	const [hasPlaybackError, setHasPlaybackError] = useState(false);

	useEffect(() => {
		if (!recordRef.current) return;
		const obs = new IntersectionObserver(([entry]) => {
			setIsRecordVisible(entry.isIntersecting);
		});
		obs.observe(recordRef.current);
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const markPlaying = () => setIsPlayingPreview(true);
		const markPaused = () => setIsPlayingPreview(false);
		const markEnded = () => {
			setIsPlayingPreview(false);
			audio.currentTime = 0;
		};
		const markError = () => {
			setHasPlaybackError(true);
			setIsPlayingPreview(false);
		};

		audio.addEventListener("play", markPlaying);
		audio.addEventListener("pause", markPaused);
		audio.addEventListener("ended", markEnded);
		audio.addEventListener("error", markError);

		return () => {
			audio.removeEventListener("play", markPlaying);
			audio.removeEventListener("pause", markPaused);
			audio.removeEventListener("ended", markEnded);
			audio.removeEventListener("error", markError);
		};
	}, []);

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
			if (recordSurfaceRef.current) {
				scratchRotation.current = getElementRotation(recordSurfaceRef.current);
				recordSurfaceRef.current.style.animation = "none";
				recordSurfaceRef.current.style.setProperty(
					"--record-spin-offset",
					`${scratchRotation.current}deg`,
				);
				recordSurfaceRef.current.style.transform = `rotate(${scratchRotation.current}deg)`;
			}
			isScratching.current = true;
			setIsScratchingRecord(true);
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
			scratchRotation.current += delta;
			if (recordSurfaceRef.current) {
				recordSurfaceRef.current.style.setProperty(
					"--record-spin-offset",
					`${scratchRotation.current}deg`,
				);
				recordSurfaceRef.current.style.transform = `rotate(${scratchRotation.current}deg)`;
			}
			lastAngle.current = angle;
		},
		[getAngleFromCenter],
	);

	const stopScratching = useCallback(() => {
		isScratching.current = false;
		if (recordSurfaceRef.current) {
			recordSurfaceRef.current.style.setProperty(
				"--record-spin-offset",
				`${scratchRotation.current}deg`,
			);
			recordSurfaceRef.current.style.animation = "";
			recordSurfaceRef.current.style.transform = "";
		}
		setIsScratchingRecord(false);
	}, []);

	const togglePreview = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio || !canPlayPreview || hasPlaybackError) return;

		if (!audio.paused) {
			audio.pause();
			return;
		}

		try {
			setHasPlaybackError(false);
			await audio.play();
		} catch {
			setHasPlaybackError(true);
			setIsPlayingPreview(false);
		}
	}, [canPlayPreview, hasPlaybackError]);

	const previewControlLabel = !canPlayPreview
		? `Preview unavailable for ${previewTitle}`
		: isPlayingPreview
			? `Pause ${previewTitle} preview`
			: `Play ${previewTitle} preview`;
	const shouldSpinRecord = shouldReduceMotion !== true && isRecordVisible && !isScratchingRecord;

	return (
		<div className="relative h-48 w-48 shrink-0">
			{canPlayPreview ? (
				// biome-ignore lint/a11y/useMediaCaption: Music preview has no spoken dialogue.
				<audio ref={audioRef} src={previewUrl} preload="none">
					{trackUrl ? <a href={trackUrl}>Open on Apple Music</a> : null}
				</audio>
			) : null}

			<div
				ref={recordRef}
				className="group absolute top-2 left-0 h-36 w-44 origin-top-left scale-125 "
			>
				{/*fake rectangle shadow*/}
				<div className="pointer-events-none absolute left-0 top-1 z-0 h-[6.8rem] w-[6.8rem] rotate-[-3deg]">
					<div className="absolute inset-[2.5%] rounded-[1px] shadow-[0_10px_18px_rgba(42,35,29,0.18)]" />
				</div>

				{/*fake circle shadow*/}
				<div className="pointer-events-none absolute -top-1 left-9 z-0 size-30 transition-[left] duration-150 group-hover:left-12">
					<div className="absolute inset-[13%] rounded-full shadow-[0_8px_18px_rgba(42,35,29,0.2)]" />
				</div>

				{/*fake rectangle border*/}
				<div className="pointer-events-none absolute left-0 top-1 z-10 h-[6.8rem] w-[6.8rem] rotate-[-3deg]">
					<div className="absolute inset-[2.5%] rounded-[1px] bg-white shadow-[0_0_0_4px_white]" />
				</div>

				<div className="absolute -top-1 left-9 z-20 size-30 transition-[left] duration-150 group-hover:left-12">
					{/*fake circle border*/}
					<div className="pointer-events-none absolute inset-[13%] rounded-full bg-white shadow-[0_0_0_4px_white]" />
					<div
						ref={recordSurfaceRef}
						className={cn(
							"absolute inset-0 cursor-grab rounded-full active:cursor-grabbing [clip-path:circle(50%)] touch-action-none",
							shouldSpinRecord && "animate-vinyl",
						)}
						style={
							{ "--record-spin-offset": `${scratchRotation.current}deg` } as React.CSSProperties
						}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={stopScratching}
						onPointerCancel={stopScratching}
						onLostPointerCapture={stopScratching}
					>
						<img src="/record content.png" alt="" className="h-full w-full" draggable={false} />
						<svg
							viewBox="0 0 59 59"
							className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2"
							xmlns="http://www.w3.org/2000/svg"
							role="img"
							aria-label="Album art"
						>
							<defs>
								<clipPath id={VINYL_LABEL_CLIP_ID}>
									<path d={VINYL_LABEL_PATH} />
								</clipPath>
							</defs>
							<image
								href={albumArt}
								x="0"
								y="0"
								width="59"
								height="59"
								preserveAspectRatio="xMidYMid slice"
								clipPath={`url(#${VINYL_LABEL_CLIP_ID})`}
							/>
						</svg>
					</div>

					<img
						src="/specular highlight.svg"
						alt=""
						className="pointer-events-none absolute top-[17px] right-5 z-20 w-10 mix-blend-color-dodge"
						draggable={false}
					/>
				</div>
				<div className="absolute left-0 top-1 h-[6.8rem] w-[6.8rem] rotate-[-3deg] isolate z-30">
					<div className="absolute inset-0 z-0 mask-[url(/sleeve.webp)] mask-center mask-no-repeat mask-size-[100%_100%]">
						<img
							src={albumArt}
							alt=""
							className="absolute top-1/2 left-1/2 h-[96%] w-[96%] -translate-x-1/2 -translate-y-1/2 rotate-0 object-cover"
							draggable={false}
						/>
					</div>
					<img
						src="/sleeve.webp"
						alt=""
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover mix-blend-lighten opacity-90"
						draggable={false}
					/>
					<img
						src="/sleeve.webp"
						alt=""
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover mix-blend-exclusion opacity-60"
						draggable={false}
					/>
					<button
						type="button"
						className={cn(
							"absolute right-3 bottom-3 z-40 grid size-4.5 place-items-center rounded-full  bg-white transition duration-200 ease-out  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal active:translate-y-0 cursor-pointer disabled:pointer-events-none disabled:opacity-45 hover:scale-110",
							isPlayingPreview && "scale-105",
						)}
						onClick={togglePreview}
						disabled={!canPlayPreview || hasPlaybackError}
						aria-label={previewControlLabel}
						aria-pressed={canPlayPreview ? isPlayingPreview : undefined}
						title={previewControlLabel}
					>
						{/*add a span block with absolute positioning for both icons, so that they can exist on top of each other while animating*/}
						<span className="relative block size-3">
							<AnimatePresence initial={false}>
								<motion.img
									key={isPlayingPreview ? "pause" : "play"}
									src={isPlayingPreview ? PAUSE_ICON_SRC : PLAY_ICON_SRC}
									alt=""
									aria-hidden="true"
									className="pointer-events-none size-3 absolute inset-0"
									draggable={false}
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									exit={{ scale: 0 }}
									transition={{
										scale: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
									}}
								/>
							</AnimatePresence>
						</span>
					</button>
				</div>
			</div>

			<div className="absolute -top-6 right-4 rotate-12 scale-115">
				<img src="/music-string.svg" alt="" />
			</div>

			{artistName ? (
				<ArtistNameStrip
					key={artistName}
					artistName={artistName}
					shouldReduceMotion={shouldReduceMotion}
				/>
			) : null}
		</div>
	);
}
