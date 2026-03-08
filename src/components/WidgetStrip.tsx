import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { PhotoFrameData, SongData } from "@/lib/music";
import MusicWidget from "./widgets/MusicWidget";
import PhotoFrameWidget from "./widgets/PhotoFrameWidget";
import SnapsWidget from "./widgets/SnapsWidget";

interface Props {
	songData: SongData;
	photoFrame: PhotoFrameData;
	children?: ReactNode;
}

export default function WidgetStrip({ songData, photoFrame, children }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const [dragRight, setDragRight] = useState(0);

	useEffect(() => {
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
	}, []);

	return (
		<div ref={containerRef} className="overflow-hidden overflow-y-visible py-12 w-full">
			<motion.div
				ref={innerRef}
				drag="x"
				dragConstraints={{ left: dragRight, right: 0 }}
				dragElastic={0.35}
				dragTransition={{
					bounceStiffness: 300,
					bounceDamping: 40,
				}}
				className="flex gap-6 items-center w-max pr-16 pl-32 cursor-grab active:cursor-grabbing"
			>
				<MusicWidget songData={songData} />
				<a href="/about" className="no-underline mx-5">
					<PhotoFrameWidget src={photoFrame.src} alt={photoFrame.alt} />
				</a>
				<a href="/snaps" className="no-underline">
					<SnapsWidget />
				</a>

				{children}
			</motion.div>
		</div>
	);
}
