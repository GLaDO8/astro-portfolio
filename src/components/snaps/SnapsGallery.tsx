import type { ImageMetadata } from "astro";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export type SnapsGalleryItem = {
	readonly src: string;
	readonly date: string;
	readonly year: number;
	readonly caption: string;
	readonly span: number;
	readonly image: Pick<ImageMetadata, "src" | "width" | "height">;
};

type SnapsGalleryProps = {
	readonly snaps: readonly SnapsGalleryItem[];
	readonly priorityCount?: number;
};

function getSnapAlt(item: SnapsGalleryItem) {
	return item.caption || `Photograph taken on ${item.date}, ${item.year}`;
}

function getSnapGalleryHeight(item: SnapsGalleryItem) {
	const ratio = item.image.height / item.image.width;
	if (ratio > 1.6) {
		return "h-180";
	}
	if (ratio > 1) {
		return "h-144";
	}
	return "h-96";
}

export default function SnapsGallery({ snaps, priorityCount = 0 }: SnapsGalleryProps) {
	return (
		<motion.div
			className="flex w-full items-center gap-x-24 overflow-x-scroll overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-24"
			data-snaps-grid=""
			initial={false}
			transition={{ type: "spring" }}
		>
			{snaps.map((item, itemIndex) => {
				const isPriority = itemIndex < priorityCount;

				return (
					<motion.figure
						key={item.src}
						className={cn("flex-none border-12 border-white", randomRotation())}
						data-snap-span={item.span}
						data-snap-date={`${item.date} ${item.year}`}
					>
						<img
							className={cn("object-cover w-full", getSnapGalleryHeight(item))}
							src={item.image.src}
							alt={getSnapAlt(item)}
							width={item.image.width}
							height={item.image.height}
							loading={isPriority ? "eager" : "lazy"}
							decoding="async"
							draggable={false}
						/>
					</motion.figure>
				);
			})}
		</motion.div>
	);
}
