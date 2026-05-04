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

const rotations = ["-rotate-[3deg]", "rotate-[2deg]", "-rotate-[2deg]", "rotate-[3deg]"];
const rotationMotion = [-3, 2, -2, 3];
function randomRotation() {
	return rotations[Math.floor(Math.random() * rotations.length)];
}

function randomRotationMotion() {
	return rotationMotion[Math.floor(Math.random() * rotationMotion.length)];
}

export default function SnapsGallery({ snaps, priorityCount = 0 }: SnapsGalleryProps) {
	return (
		<motion.div
			className="flex w-full items-center gap-x-24 overflow-x-scroll overflow-y-hidden overscroll-x-contain px-24 py-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			data-snaps-grid=""
			initial={false}
		>
			{snaps.map((item, itemIndex) => {
				const isPriority = itemIndex < priorityCount;

				return (
					<motion.figure
						key={item.src}
						className={cn(
							"rounded-md flex-none border-12 border-white bg-white shadow-[0_12px_34px_-12px_rgb(42_35_29_/_0.42),0_4px_16px_-8px_rgb(42_35_29_/_0.24),0_1px_3px_rgb(42_35_29_/_0.1)]",
							randomRotation(),
						)}
						data-snap-span={item.span}
						data-snap-date={`${item.date} ${item.year}`}
						whileHover={{ scale: 1.05, rotate: randomRotationMotion() }}
						transition={{ type: "spring", bounce: 0.3, visualDuration: 0.2 }}
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
