import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SongData } from "@/lib/widgetConfig";
import pauseIconSvg from "../../assets/widgets/pause.svg?raw";
import playIconSvg from "../../assets/widgets/play.svg?raw";

const PLAY_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(playIconSvg)}`;
const PAUSE_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(pauseIconSvg)}`;
const VINYL_LABEL_CLIP_ID = "music-widget-vinyl-label";
const MUSIC_STRIP_GAP_PX = 24;
const MUSIC_WIDGET_DEBUG_KEY = "musicWidgetDebug";
const VINYL_LABEL_PATH =
	"M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";
const AUDIO_ERROR_LABELS: Record<number, string> = {
	1: "MEDIA_ERR_ABORTED",
	2: "MEDIA_ERR_NETWORK",
	3: "MEDIA_ERR_DECODE",
	4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
};
const AUDIO_NETWORK_STATE_LABELS: Record<number, string> = {
	0: "NETWORK_EMPTY",
	1: "NETWORK_IDLE",
	2: "NETWORK_LOADING",
	3: "NETWORK_NO_SOURCE",
};
const AUDIO_READY_STATE_LABELS: Record<number, string> = {
	0: "HAVE_NOTHING",
	1: "HAVE_METADATA",
	2: "HAVE_CURRENT_DATA",
	3: "HAVE_FUTURE_DATA",
	4: "HAVE_ENOUGH_DATA",
};

type PreviewDisabledReason = "missing-preview-url" | "playback-error";

export function getPreviewDisabledReason({
	canPlayPreview,
	hasPlaybackError,
}: {
	canPlayPreview: boolean;
	hasPlaybackError: boolean;
}): PreviewDisabledReason | null {
	if (!canPlayPreview) return "missing-preview-url";
	if (hasPlaybackError) return "playback-error";
	return null;
}

function getElementRotation(element: HTMLElement) {
	const transform = getComputedStyle(element).transform;
	if (!transform || transform === "none") return 0;

	const matrix = new DOMMatrixReadOnly(transform);
	return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

function isLocalPreviewHost(hostname: string) {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

function isMusicWidgetDebugEnabled() {
	if (typeof window === "undefined") return false;
	if (isLocalPreviewHost(window.location.hostname)) return true;
	if (new URLSearchParams(window.location.search).has(MUSIC_WIDGET_DEBUG_KEY)) return true;

	try {
		const storedValue = window.localStorage.getItem(MUSIC_WIDGET_DEBUG_KEY);
		return storedValue === "1" || storedValue === "true";
	} catch {
		return false;
	}
}

function serializeError(err: unknown) {
	if (err instanceof Error) {
		return { message: err.message, name: err.name };
	}
	return { message: String(err) };
}

function getFiniteMediaTime(value: number) {
	return Number.isFinite(value) ? Number(value.toFixed(2)) : value;
}

function getAudioDebugState(audio: HTMLAudioElement | null) {
	if (!audio) return { hasAudioElement: false };

	return {
		currentSrc: audio.currentSrc,
		currentTime: getFiniteMediaTime(audio.currentTime),
		duration: getFiniteMediaTime(audio.duration),
		ended: audio.ended,
		error: audio.error
			? {
					code: audio.error.code,
					label: AUDIO_ERROR_LABELS[audio.error.code] ?? "MEDIA_ERR_UNKNOWN",
					message: audio.error.message,
				}
			: null,
		hasAudioElement: true,
		networkState: audio.networkState,
		networkStateLabel:
			AUDIO_NETWORK_STATE_LABELS[audio.networkState] ?? `NETWORK_${audio.networkState}`,
		paused: audio.paused,
		readyState: audio.readyState,
		readyStateLabel: AUDIO_READY_STATE_LABELS[audio.readyState] ?? `HAVE_${audio.readyState}`,
		src: audio.getAttribute("src"),
	};
}

function logMusicWidget(
	level: "debug" | "warn",
	eventName: string,
	payload: Record<string, unknown>,
) {
	if (!isMusicWidgetDebugEnabled()) return;
	console[level](`[music-widget] ${eventName}`, payload);
}

interface Props {
	songData: SongData;
}

interface MusicStripLineProps {
	className?: string;
	shouldReduceMotion: boolean | null;
	text: string;
}

function MusicStripLine({ className, shouldReduceMotion, text }: MusicStripLineProps) {
	const viewportRef = useRef<HTMLParagraphElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const [stripDistance, setStripDistance] = useState(0);

	useEffect(() => {
		const viewport = viewportRef.current;
		const textNode = textRef.current;
		if (!viewport || !textNode) return;

		const measureOverflow = () => {
			const textWidth = textNode.scrollWidth;
			const nextStripDistance =
				textWidth - viewport.clientWidth > 1 ? textWidth + MUSIC_STRIP_GAP_PX : 0;
			setStripDistance(nextStripDistance);
		};

		measureOverflow();

		const resizeObserver = new ResizeObserver(measureOverflow);
		resizeObserver.observe(viewport);
		resizeObserver.observe(textNode);
		window.addEventListener("load", measureOverflow);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("load", measureOverflow);
		};
	}, []);

	const shouldAnimate = stripDistance > 0 && !shouldReduceMotion;

	return (
		<p
			ref={viewportRef}
			className={cn(
				"overflow-hidden py-0.5 font-sans leading-tight text-primary",
				className,
				shouldAnimate &&
					"[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]",
			)}
			title={text}
		>
			<motion.span
				className={cn(
					"whitespace-nowrap",
					shouldAnimate ? "inline-flex w-max gap-6 text-left" : "block w-full",
				)}
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
					{text}
				</span>
				{shouldAnimate ? (
					<span aria-hidden="true" className="shrink-0">
						{text}
					</span>
				) : null}
			</motion.span>
		</p>
	);
}

interface MusicMetadataStripProps {
	label: string;
	shouldReduceMotion: boolean | null;
}

function MusicMetadataStrip({ label, shouldReduceMotion }: MusicMetadataStripProps) {
	return (
		<div className="absolute -bottom-2 left-1 z-40 w-36 rotate-[-2.5deg]">
			<MusicStripLine
				key={label}
				className="text-sm font-semibold"
				shouldReduceMotion={shouldReduceMotion}
				text={label}
			/>
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
	const songTitle = songData.title.trim();
	const metadataLabel = [artistName, songTitle].filter(Boolean).join(" - ");
	const previewUrl = songData.previewUrl.trim();
	const trackUrl = songData.trackUrl.trim();
	const previewTitle = songData.title || songData.album || artistName || "song";
	const canPlayPreview = Boolean(previewUrl);
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlayingPreview, setIsPlayingPreview] = useState(false);
	const [hasPlaybackError, setHasPlaybackError] = useState(false);
	const previewDisabledReason = getPreviewDisabledReason({
		canPlayPreview,
		hasPlaybackError,
	});
	const lastDisabledLogKey = useRef<string | null>(null);

	const getPreviewDebugPayload = useCallback(
		(audio: HTMLAudioElement | null, extra: Record<string, unknown> = {}) => ({
			artistName,
			audio: getAudioDebugState(audio),
			canPlayPreview,
			disabledReason: previewDisabledReason,
			hasPlaybackError,
			previewTitle,
			previewUrl,
			trackUrl,
			...extra,
		}),
		[
			artistName,
			canPlayPreview,
			hasPlaybackError,
			previewDisabledReason,
			previewTitle,
			previewUrl,
			trackUrl,
		],
	);

	useEffect(() => {
		if (!recordRef.current) return;
		const obs = new IntersectionObserver(([entry]) => {
			setIsRecordVisible(entry.isIntersecting);
		});
		obs.observe(recordRef.current);
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		if (!previewDisabledReason) {
			lastDisabledLogKey.current = null;
			return;
		}

		const logKey = `${previewDisabledReason}:${previewUrl}:${trackUrl}`;
		if (lastDisabledLogKey.current === logKey) return;
		lastDisabledLogKey.current = logKey;

		logMusicWidget(
			"warn",
			"preview disabled",
			getPreviewDebugPayload(audioRef.current, { reason: previewDisabledReason }),
		);
	}, [getPreviewDebugPayload, previewDisabledReason, previewUrl, trackUrl]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const markPlaying = () => {
			setIsPlayingPreview(true);
			logMusicWidget("debug", "audio play", getPreviewDebugPayload(audio));
		};
		const markPaused = () => {
			setIsPlayingPreview(false);
			logMusicWidget("debug", "audio pause", getPreviewDebugPayload(audio));
		};
		const markEnded = () => {
			setIsPlayingPreview(false);
			audio.currentTime = 0;
			logMusicWidget("debug", "audio ended", getPreviewDebugPayload(audio));
		};
		const markError = () => {
			logMusicWidget(
				"warn",
				"audio error",
				getPreviewDebugPayload(audio, { nextDisabledReason: "playback-error" }),
			);
			setHasPlaybackError(true);
			setIsPlayingPreview(false);
		};
		const markStalled = () => {
			logMusicWidget("warn", "audio stalled", getPreviewDebugPayload(audio));
		};
		const markAbort = () => {
			logMusicWidget("warn", "audio abort", getPreviewDebugPayload(audio));
		};

		audio.addEventListener("play", markPlaying);
		audio.addEventListener("pause", markPaused);
		audio.addEventListener("ended", markEnded);
		audio.addEventListener("error", markError);
		audio.addEventListener("stalled", markStalled);
		audio.addEventListener("abort", markAbort);

		return () => {
			audio.removeEventListener("play", markPlaying);
			audio.removeEventListener("pause", markPaused);
			audio.removeEventListener("ended", markEnded);
			audio.removeEventListener("error", markError);
			audio.removeEventListener("stalled", markStalled);
			audio.removeEventListener("abort", markAbort);
		};
	}, [getPreviewDebugPayload]);

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
		if (!audio || previewDisabledReason) {
			logMusicWidget(
				"warn",
				"toggle blocked",
				getPreviewDebugPayload(audio, {
					reason: !audio ? "missing-audio-element" : previewDisabledReason,
				}),
			);
			return;
		}

		if (!audio.paused) {
			logMusicWidget("debug", "pause requested", getPreviewDebugPayload(audio));
			audio.pause();
			return;
		}

		try {
			setHasPlaybackError(false);
			logMusicWidget("debug", "play requested", getPreviewDebugPayload(audio));
			await audio.play();
			logMusicWidget("debug", "play resolved", getPreviewDebugPayload(audio));
		} catch (err) {
			logMusicWidget(
				"warn",
				"play rejected",
				getPreviewDebugPayload(audio, {
					error: serializeError(err),
					nextDisabledReason: "playback-error",
				}),
			);
			setHasPlaybackError(true);
			setIsPlayingPreview(false);
		}
	}, [getPreviewDebugPayload, previewDisabledReason]);

	const previewControlLabel = !canPlayPreview
		? `Preview unavailable for ${previewTitle}`
		: isPlayingPreview
			? `Pause ${previewTitle} preview`
			: `Play ${previewTitle} preview`;
	const shouldSpinRecord = shouldReduceMotion !== true && isRecordVisible && !isScratchingRecord;

	const vinylVariantParent = {
		rest: {},
		hover: {},
	};

	const vinylVariantChild = {
		rest: { left: 36 },
		hover: { left: 56 },
	};

	return (
		<div className="relative h-48 w-48 shrink-0">
			{canPlayPreview ? (
				// biome-ignore lint/a11y/useMediaCaption: Music preview has no spoken dialogue.
				<audio ref={audioRef} src={previewUrl} preload="none">
					{trackUrl ? <a href={trackUrl}>Open on Apple Music</a> : null}
				</audio>
			) : null}

			<style>{`
				@keyframes music-widget-vinyl-spin {
					from {
						transform: rotate(var(--record-spin-offset, 0deg));
					}

					to {
						transform: rotate(calc(var(--record-spin-offset, 0deg) + 360deg));
					}
				}

				.music-widget-vinyl-spin {
					animation: music-widget-vinyl-spin 1.8182s linear infinite;
				}

				@media (prefers-reduced-motion: reduce) {
					.music-widget-vinyl-spin {
						animation: none;
					}
				}
			`}</style>

			<div className="scale-110">
				<motion.div
					initial="rest"
					whileHover="hover"
					variants={vinylVariantParent}
					ref={recordRef}
					className="group absolute top-2 left-0 h-36 w-44 origin-top-left scale-125 "
				>
					{/*fake rectangle shadow*/}
					<div className="pointer-events-none absolute left-0 top-1 z-0 h-[6.8rem] w-[6.8rem] rotate-[-3deg]">
						<div className="absolute inset-[2.5%] rounded-[1px] shadow-[0_12px_30px_3px_rgba(42,35,29,0.2),0_0_4px_3px_rgba(122,122,122,0.2)]" />
					</div>

					{/*fake rectangle border*/}
					<div className="pointer-events-none absolute left-0 top-1 z-10 h-[6.8rem] w-[6.8rem] rotate-[-3deg]">
						<div className="absolute inset-[2.5%] rounded-[1px] bg-white shadow-[0_0_0_4px_white]" />
					</div>

					{/*fake circle shadow*/}
					<motion.div
						variants={vinylVariantChild}
						transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}
						className="pointer-events-none absolute -top-1 left-9 z-0 size-30"
					>
						<div className="absolute inset-[13%] rounded-full shadow-[4px_4px_30px_3px_rgba(42,35,29,0.15),-4px_0_4px_3px_rgba(122,122,122,0.2)]" />
					</motion.div>

					{/*vinyl composite*/}
					<motion.div
						variants={vinylVariantChild}
						transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}
						className="absolute -top-1 left-9 z-20 size-30"
					>
						{/*fake circle border*/}
						<div className="pointer-events-none absolute inset-[13%] rounded-full bg-white shadow-[0_0_0_4px_white]" />
						<div
							ref={recordSurfaceRef}
							className={cn(
								"absolute inset-0 cursor-grab rounded-full active:cursor-grabbing [clip-path:circle(50%)] touch-action-none",
								"[--record-spin-offset:0deg]",
								shouldSpinRecord && "music-widget-vinyl-spin",
							)}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={stopScratching}
							onPointerCancel={stopScratching}
							onLostPointerCapture={stopScratching}
						>
							<img src="/record content.webp" alt="" className="h-full w-full" draggable={false} />
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
					</motion.div>

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
						{canPlayPreview ? (
							<button
								type="button"
								className={cn(
									"absolute right-3 bottom-3 z-40 grid size-4.5 place-items-center rounded-full  bg-white transition duration-200 ease-out  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 cursor-pointer disabled:pointer-events-none disabled:opacity-45 hover:scale-110",
									isPlayingPreview && "scale-105",
								)}
								onClick={togglePreview}
								disabled={hasPlaybackError}
								data-preview-disabled-reason={previewDisabledReason ?? undefined}
								aria-label={previewControlLabel}
								aria-pressed={isPlayingPreview}
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
						) : null}
					</div>
				</motion.div>

				<div className="absolute -top-8 right-4 rotate-8 scale-115">
					<img src="/music-string.svg" alt="" />
				</div>
			</div>

			{metadataLabel ? (
				<MusicMetadataStrip
					key={metadataLabel}
					label={metadataLabel}
					shouldReduceMotion={shouldReduceMotion}
				/>
			) : null}
		</div>
	);
}
