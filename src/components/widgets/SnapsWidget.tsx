import type { ImageMetadata } from "astro";
import { motion, useReducedMotion } from "motion/react";
import snapOne from "@/assets/snaps/thumbnails/DSCF4135-Enhanced-NR-2-thumb.webp";
import snapTwo from "@/assets/snaps/thumbnails/DSCF4283-thumb.webp";
import snapThree from "@/assets/snaps/thumbnails/DSCF4449-thumb.webp";
import { cn } from "@/lib/cn";

const polaroidTransition = {
	duration: 0.2,
	ease: [0.22, 1, 0.36, 1] as const,
};

const widgetVariants = {
	rest: {},
	hover: {},
};

const baseTapeClassName = "pointer-events-none absolute z-10 select-none";
const secondPolaroidTapeClassName = "-bottom-5 left-0 rotate-16 scale-110";
const thirdPolaroidTapeClassName = "-bottom-2 right-1 -rotate-12 scale-110";

type Polaroid = {
	readonly image: ImageMetadata;
	readonly rest: {
		readonly x: number;
		readonly y: number;
		readonly rotate: number;
	};
	readonly hover: {
		readonly x: number;
		readonly y: number;
		readonly rotate: number;
	};
	readonly tape?: {
		readonly src: string;
		readonly className: string;
	};
};

const polaroids: readonly Polaroid[] = [
	{
		image: snapOne,
		rest: { x: 10, y: 35, rotate: 19 },
		hover: { x: 20, y: 20, rotate: 25 },
	},
	{
		image: snapTwo,
		rest: { x: -60, y: 45, rotate: -5 },
		hover: { x: -70, y: 20, rotate: -11 },
		tape: {
			src: "/tape-2.svg",
			className: secondPolaroidTapeClassName,
		},
	},
	{
		image: snapThree,
		rest: { x: 10, y: 110, rotate: 26 },
		hover: { x: 20, y: 90, rotate: 32 },
		tape: {
			src: "/tape.svg",
			className: thirdPolaroidTapeClassName,
		},
	},
];

export default function SnapsWidget() {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			className="relative h-[11.75rem] w-[9.5rem] shrink-0 cursor-pointer -rotate-8"
			initial="rest"
			animate="rest"
			whileHover={shouldReduceMotion ? undefined : "hover"}
			variants={widgetVariants}
			aria-label="Photo Roll"
		>
			{polaroids.map((polaroid, index) => (
				<motion.div
					key={polaroid.image.src}
					className="absolute top-0 right-0 h-[6rem] w-[4.95rem] origin-top-right rounded-[2px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_4px_rgba(122,122,122,0.2)]"
					variants={{
						rest: { ...polaroid.rest, scale: 0.9 },
						hover: { ...polaroid.hover, scale: 0.9 },
					}}
					transition={shouldReduceMotion ? { duration: 0 } : polaroidTransition}
					aria-hidden={index === 0 ? undefined : true}
				>
					{polaroid.tape ? (
						<img
							src={polaroid.tape.src}
							alt=""
							aria-hidden="true"
							className={cn(baseTapeClassName, polaroid.tape.className)}
							draggable={false}
						/>
					) : null}
					<div className="h-[4.35rem] w-full overflow-hidden rounded-[1px] bg-mist">
						<img
							src={polaroid.image.src}
							alt=""
							width={polaroid.image.width}
							height={polaroid.image.height}
							className="h-full w-full rounded-[1px] object-cover"
							loading="lazy"
							decoding="async"
							draggable={false}
						/>
					</div>
				</motion.div>
			))}
			<div className="absolute -bottom-3 right-9 rotate-24">
				<p className="font-semibold text-sm font-sans">Photo roll</p>
			</div>
		</motion.div>
	);
}
