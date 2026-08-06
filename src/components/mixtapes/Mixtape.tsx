import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const VINYL_LABEL_CLIP_ID = "mixtape-vinyl-label";
const VINYL_LABEL_PATH =
	"M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";

export interface MixtapeData {
	title: string;
	artworkSrc: string;
	artworkAlt?: string;
	description?: string;
	trackCount?: number;
	year?: string;
}

interface Props {
	className?: string;
	mixtape: MixtapeData;
	variant?: "compact" | "large";
}

function getElementRotation(element: HTMLElement) {
	const transform = getComputedStyle(element).transform;
	if (!transform || transform === "none") return 0;

	const matrix = new DOMMatrixReadOnly(transform);
	return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
}

export default function Mixtape({ className, mixtape, variant = "compact" }: Props) {
	const isScratching = useRef(false);
	const [isScratchingRecord, setIsScratchingRecord] = useState(false);
	const [isRecordVisible, setIsRecordVisible] = useState(true);
	const scratchRotation = useRef(0);
	const lastAngle = useRef(0);
	const cachedRect = useRef<DOMRect | null>(null);
	const recordRef = useRef<HTMLDivElement>(null);
	const recordSurfaceRef = useRef<HTMLDivElement>(null);
	const vinylLabelClipId = `${VINYL_LABEL_CLIP_ID}-${useId().replaceAll(":", "")}`;
	const shouldReduceMotion = useReducedMotion();
	const artworkAlt = mixtape.artworkAlt ?? `${mixtape.title} mixtape artwork`;
	const isLarge = variant === "large";

	useEffect(() => {
		if (!recordRef.current) return;

		const obs = new IntersectionObserver(([entry]) => {
			setIsRecordVisible(entry.isIntersecting);
		});
		obs.observe(recordRef.current);

		return () => obs.disconnect();
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

	const shouldSpinRecord = shouldReduceMotion !== true && isRecordVisible && !isScratchingRecord;
	const vinylVariantParent = {
		rest: {},
		hover: {},
	};
	const vinylVariantChild = {
		rest: { left: isLarge ? 42 : 36 },
		hover: { left: isLarge ? 66 : 56 },
	};

	return (
		<figure
			className={cn(
				"relative shrink-0",
				isLarge ? "h-[25rem] w-full max-w-[32rem] sm:h-[34rem]" : "h-48 w-48",
				className,
			)}
			aria-label={mixtape.title}
		>
			<style>{`
				@keyframes mixtape-vinyl-spin {
					from {
						transform: rotate(var(--record-spin-offset, 0deg));
					}

					to {
						transform: rotate(calc(var(--record-spin-offset, 0deg) + 360deg));
					}
				}

				.mixtape-vinyl-spin {
					animation: mixtape-vinyl-spin 1.8182s linear infinite;
				}

				@media (prefers-reduced-motion: reduce) {
					.mixtape-vinyl-spin {
						animation: none;
					}
				}
			`}</style>

			<div
				className={cn(
					"absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2",
					isLarge ? "scale-[1.9] sm:scale-[2.72]" : "scale-100",
				)}
			>
				<motion.div
					className="relative h-48 w-48 origin-center"
					whileHover={shouldReduceMotion ? undefined : { rotate: -5, scale: isLarge ? 1.04 : 1.1 }}
					transition={{ type: "spring", visualDuration: 0.22, bounce: 0.35 }}
				>
					<motion.div
						initial="rest"
						whileHover="hover"
						variants={vinylVariantParent}
						ref={recordRef}
						className="group absolute top-2 left-0 h-36 w-44 origin-top-left scale-125"
					>
						<div className="pointer-events-none absolute left-0 top-1 z-0 h-[6.8rem] w-[6.8rem] rotate-[-3deg]">
							<div className="absolute inset-[4%] rounded-[1px] shadow-[0_12px_30px_3px_rgba(42,35,29,0.2),0_0_4px_3px_rgba(122,122,122,0.2)]" />
						</div>

						<motion.div
							variants={vinylVariantChild}
							transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}
							className="pointer-events-none absolute -top-1 left-9 z-0 size-30"
						>
							<div className="absolute inset-[13%] rounded-full shadow-[4px_4px_30px_3px_rgba(42,35,29,0.15),-4px_0_4px_3px_rgba(122,122,122,0.2)]" />
						</motion.div>

						<motion.div
							variants={vinylVariantChild}
							transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}
							className="absolute -top-1 left-9 z-20 size-30"
						>

							<div
								ref={recordSurfaceRef}
								className={cn(
									"absolute inset-0 cursor-grab rounded-full active:cursor-grabbing [clip-path:circle(50%)] touch-action-none",
									"[--record-spin-offset:0deg]",
									shouldSpinRecord && "mixtape-vinyl-spin",
								)}
								onPointerDown={handlePointerDown}
								onPointerMove={handlePointerMove}
								onPointerUp={stopScratching}
								onPointerCancel={stopScratching}
								onLostPointerCapture={stopScratching}
							>
								<img
									src="/record content.webp"
									alt=""
									className="h-full w-full"
									draggable={false}
								/>
								<svg
									viewBox="0 0 59 59"
									className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2"
									xmlns="http://www.w3.org/2000/svg"
									aria-hidden="true"
								>
									<defs>
										<clipPath id={vinylLabelClipId} clipPathUnits="userSpaceOnUse">
											<path d={VINYL_LABEL_PATH} />
										</clipPath>
									</defs>
									<image
										href={mixtape.artworkSrc}
										x="0"
										y="0"
										width="59"
										height="59"
										preserveAspectRatio="xMidYMid slice"
										clipPath={`url(#${vinylLabelClipId})`}
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
							<div className="absolute inset-0 z-0 mask-[url(/sleeve.webp)] mask-center mask-no-repeat mask-size-[100%_100%] brightness-110 contrast-110">
								<img
									src={mixtape.artworkSrc}
									alt={artworkAlt}
									className="absolute top-1/2 left-1/2 h-[96%] w-[96%] -translate-x-1/2 -translate-y-1/2 rotate-0 object-cover"
									draggable={false}
								/>
							</div>
							<img
								src="/sleeve.webp"
								alt=""
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover mix-blend-lighten opacity-100"
								draggable={false}
							/>
							{/*<img
								src="/sleeve.webp"
								alt=""
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover mix-blend-exclusion opacity-60"
								draggable={false}
							/>*/}
						</div>
					</motion.div>
				</motion.div>
			</div>
		</figure>
	);
}
