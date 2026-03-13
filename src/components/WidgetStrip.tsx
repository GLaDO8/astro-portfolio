import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { GithubData } from "@/lib/github";
import type { PhotoFrameData, SongData } from "@/lib/widgetConfig";
import GithubWidget from "./widgets/GithubWidget";
import MusicWidget from "./widgets/MusicWidget";
import PhotoFrameWidget from "./widgets/PhotoFrameWidget";
import SnapsWidget from "./widgets/SnapsWidget";

interface Props {
	songData: SongData;
	photoFrame: PhotoFrameData;
	githubData: GithubData;
	children?: ReactNode;
}

export default function WidgetStrip({ songData, photoFrame, githubData, children }: Props) {
	const containerRef = useRef<HTMLElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const photoRef = useRef<HTMLAnchorElement>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [dragLeft, setDragLeft] = useState(0);
	const dragX = useMotionValue(0);
	const shouldReduceMotion = useReducedMotion();

	useEffect(() => {
		const mql = window.matchMedia("(max-width: 768px)");
		const onChange = () => setIsMobile(mql.matches);
		onChange();
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		const inner = innerRef.current;
		const photo = photoRef.current;
		if (!container || !inner || !photo) return;

		const measure = () => {
			const containerWidth = container.clientWidth;
			const photoCenter = photo.offsetLeft + photo.offsetWidth / 1.5;

			if (isMobile) {
				// Center the PhotoFrame slightly left of viewport center
				const offset = -(photoCenter - containerWidth / 2) + 24;
				const overflow = inner.scrollWidth - containerWidth;
				const minX = overflow > 0 ? -overflow : 0;
				setDragLeft(minX);
				dragX.set(Math.max(minX, Math.min(0, offset)));
			}
		};

		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [isMobile, dragX]);

	return (
		<section
			ref={containerRef}
			aria-label="Widget strip"
			className={cn(
				"overflow-y-visible py-12 w-full",
				isMobile ? "overflow-hidden" : "overflow-x-auto scrollbar-hide",
			)}
		>
			<motion.div
				ref={innerRef}
				style={isMobile ? { x: dragX } : undefined}
				{...(isMobile
					? {
							drag: "x" as const,
							dragConstraints: { left: dragLeft, right: 0 },
							dragElastic: shouldReduceMotion ? 0 : 0.35,
							dragTransition: shouldReduceMotion
								? { bounceStiffness: 0, bounceDamping: 0 }
								: {
										bounceStiffness: 300,
										bounceDamping: 40,
									},
						}
					: {})}
				className={cn(
					"flex gap-8 items-top w-max px-8 md:pl-36 md:pr-16",
					isMobile && "cursor-grab active:cursor-grabbing select-none touch-action-pan-y",
				)}
			>
				<MusicWidget songData={songData} />
				<a ref={photoRef} href="/about" aria-label="About me" className="no-underline mx-5">
					<PhotoFrameWidget src={photoFrame.src} alt={photoFrame.alt} />
				</a>
				<a href="/snaps" aria-label="Photo snaps" className="no-underline">
					<SnapsWidget />
				</a>
				{/*<GithubWidget data={githubData} />*/}

				{children}
			</motion.div>
		</section>
	);
}
