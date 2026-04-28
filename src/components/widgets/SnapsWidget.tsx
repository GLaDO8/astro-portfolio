import type { ImageMetadata } from "astro";
import { motion, useReducedMotion } from "motion/react";
import snapOne from "@/assets/snaps/DSCF4135-Enhanced-NR-2.webp";
import snapTwo from "@/assets/snaps/DSCF4283.webp";
import snapThree from "@/assets/snaps/DSCF4449.webp";
import { cn } from "@/lib/cn";

const polaroidTransition = {
	duration: 0.32,
	ease: [0.22, 1, 0.36, 1] as const,
};

type Polaroid = {
	readonly image: ImageMetadata;
	readonly positionClass: string;
	readonly hover: {
		readonly x: number;
		readonly y: number;
		readonly rotate: number;
	};
	readonly hasTape?: boolean;
};

const polaroids: readonly Polaroid[] = [
	{
		image: snapOne,
		positionClass: "left-12 top-0 rotate-[-3deg]",
		hover: { x: 5, y: -8, rotate: 1 },
	},
	{
		image: snapTwo,
		positionClass: "left-0 top-12 rotate-[-24deg]",
		hover: { x: -8, y: -6, rotate: -6 },
	},
	{
		image: snapThree,
		positionClass: "left-16 top-18 rotate-[5deg]",
		hover: { x: 8, y: -4, rotate: 10 },
		hasTape: true,
	},
];

export default function SnapsWidget() {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			className="relative h-[11.75rem] w-[9.5rem] shrink-0 cursor-pointer"
			initial="rest"
			animate="rest"
			whileHover={shouldReduceMotion ? undefined : "hover"}
			aria-label="Photo Roll"
		>
			{polaroids.map((polaroid, index) => (
				<motion.div
					key={polaroid.image.src}
					className={cn(
						"absolute h-[6rem] w-[4.95rem] rounded-[2px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_4px_rgba(122,122,122,0.2)]",
						polaroid.positionClass,
					)}
					variants={{
						rest: { x: 0, y: 0 },
						hover: polaroid.hover,
					}}
					transition={shouldReduceMotion ? { duration: 0 } : polaroidTransition}
					aria-hidden={index === 0 ? undefined : true}
				>
					{polaroid.hasTape ? (
						<img
							src="/tape.svg"
							alt=""
							aria-hidden="true"
							className="-rotate-12 pointer-events-none absolute -bottom-2 right-1 z-10 scale-110 select-none"
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
			<div className="absolute -bottom-2 right-6 rotate-4">
				<p className="font-semibold text-sm font-sans">Photo roll</p>
			</div>
		</motion.div>
	);
}
