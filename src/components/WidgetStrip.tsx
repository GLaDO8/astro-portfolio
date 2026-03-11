import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
	const containerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const [dragRight, setDragRight] = useState(0);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia("(max-width: 768px)");
		const onChange = () => setIsMobile(mql.matches);
		onChange();
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		if (!isMobile) return;
		const measure = () => {
			const container = containerRef.current;
			const inner = innerRef.current;
			if (!container || !inner) return;
			const overflow = inner.scrollWidth - container.clientWidth;
			setDragRight(overflow > 0 ? -overflow : 0);
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [isMobile]);

	return (
		<div
			ref={containerRef}
			className={`overflow-y-visible py-12 w-full ${isMobile ? "overflow-hidden" : "overflow-x-auto scrollbar-hide"}`}
		>
			<motion.div
				ref={innerRef}
				{...(isMobile
					? {
							drag: "x" as const,
							dragConstraints: { left: dragRight, right: 0 },
							dragElastic: 0.35,
							dragTransition: {
								bounceStiffness: 300,
								bounceDamping: 40,
							},
						}
					: {})}
				className={`flex gap-6 items-top w-max pr-16 pl-32 ${isMobile ? "cursor-grab active:cursor-grabbing" : ""}`}
			>
				<MusicWidget songData={songData} />
				<a href="/about" className="no-underline mx-5">
					<PhotoFrameWidget src={photoFrame.src} alt={photoFrame.alt} />
				</a>
				<a href="/snaps" className="no-underline">
					<SnapsWidget />
				</a>
				<GithubWidget data={githubData} />

				{children}
			</motion.div>
		</div>
	);
}
