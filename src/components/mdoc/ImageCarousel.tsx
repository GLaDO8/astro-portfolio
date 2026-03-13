import { motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface CarouselImage {
	src: string;
	alt?: string;
	caption?: string;
}

interface Props {
	images: string; // Delimited string: "src|caption,,src|caption"
}

export default function ImageCarousel({ images: imagesStr }: Props) {
	const items: CarouselImage[] = imagesStr.split(",,").map((entry) => {
		const [src, caption] = entry.split("|");
		return { src: src.trim(), caption: caption?.trim() };
	});
	const [current, setCurrent] = useState(0);
	const prefersReducedMotion = useReducedMotion();
	const containerRef = useRef<HTMLElement>(null);

	const goTo = useCallback(
		(index: number) => {
			setCurrent((index + items.length) % items.length);
		},
		[items.length],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				goTo(current - 1);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				goTo(current + 1);
			}
		},
		[goTo, current],
	);

	const item = items[current];

	return (
		<figure
			ref={containerRef}
			className="not-prose my-6 m-0 outline-none lg:relative"
			tabIndex={0}
			onKeyDown={handleKeyDown}
			role="group"
			aria-roledescription="carousel"
			aria-label={`Image carousel, ${items.length} slides`}
		>
			<div className="overflow-hidden rounded-lg">
				<motion.div
					className="flex"
					animate={{ x: `${current * -100}%` }}
					transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
				>
					{items.map((img, i) => (
						<img
							key={img.src}
							src={img.src}
							alt={img.alt || ""}
							loading={i === 0 ? "eager" : "lazy"}
							decoding="async"
							className="w-full shrink-0 block"
							draggable={false}
						/>
					))}
				</motion.div>
			</div>

			{/* Mobile: caption + nav in a row */}
			<div className="flex items-center justify-between mt-2 gap-4 lg:justify-end">
				{item.caption && (
					<figcaption className="font-sans text-sm text-text-secondary lg:hidden">
						{item.caption}
					</figcaption>
				)}

				{items.length > 1 && (
					<div className="flex items-center gap-3 shrink-0">
						<button
							type="button"
							onClick={() => goTo(current - 1)}
							className="w-7 h-7 rounded-full bg-text-primary/10 hover:bg-text-primary/20 text-text-primary flex items-center justify-center transition-colors cursor-pointer"
							aria-label="Previous image"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
								<path
									d="M10 12L6 8L10 4"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
						<div className="flex gap-1.5">
							{items.map((img, i) => (
								<button
									key={`dot-${img.src}`}
									type="button"
									onClick={() => goTo(i)}
									className={cn(
										"w-1.5 h-1.5 rounded-full transition-colors cursor-pointer",
										i === current ? "bg-text-primary" : "bg-text-primary/30",
									)}
									aria-label={`Go to image ${i + 1}`}
								/>
							))}
						</div>
						<button
							type="button"
							onClick={() => goTo(current + 1)}
							className="w-7 h-7 rounded-full bg-text-primary/10 hover:bg-text-primary/20 text-text-primary flex items-center justify-center transition-colors cursor-pointer"
							aria-label="Next image"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
								<path
									d="M6 4L10 8L6 12"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
					</div>
				)}
			</div>

			{/* Desktop: caption as sidenote in margin */}
			{item.caption && (
				<aside className="hidden lg:block font-sans font-medium text-sm leading-normal text-[#333f46] rounded-lg p-4 bg-[#c0e0e0] absolute top-0 right-0 translate-x-[calc(100%+2.5rem)] w-70">
					{item.caption}
				</aside>
			)}
		</figure>
	);
}
