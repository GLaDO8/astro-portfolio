import { motion, useReducedMotion } from "motion/react";
import snapOne from "@/assets/snaps/DSCF4135-Enhanced-NR-2.webp";
import snapTwo from "@/assets/snaps/DSCF4283.webp";
import snapThree from "@/assets/snaps/DSCF4449.webp";

const polaroids = [
	{
		image: snapOne,
		rest: { x: 30, y: -20, rotate: 19 },
		hover: { x: 40, y: -35, rotate: 25 },
	},
	{
		image: snapTwo,
		rest: { x: -60, y: 5, rotate: -5 },
		hover: { x: -70, y: -20, rotate: -11 },
	},
	{
		image: snapThree,
		rest: { x: 30, y: 70, rotate: 26 },
		hover: { x: 40, y: 50, rotate: 32 },
	},
] as const;

const transition = {
	duration: 0.32,
	ease: [0.22, 1, 0.36, 1] as const,
};

export default function SnapsWidget() {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			className="relative flex h-40 shrink-0 overflow-visible rounded-xl bg-white border-2 border-[#E7E9E1] cursor-pointer"
			initial="rest"
			animate="rest"
			whileHover={shouldReduceMotion ? undefined : "hover"}
		>
			<div className="flex h-full flex-col p-6">
				<div className="pb-4 font-sans text-xl leading-9 font-bold tracking-[-0.02em] text-[color(display-p3_0.121_0.153_0.016)]">
					Snaps
				</div>
				<div className="font-sans text-base leading-tight font-medium tracking-[-0.02em] text-[color(display-p3_0.121_0.153_0.016)] max-w-42">
					Poetry written with my camera
				</div>
			</div>

			{polaroids.map((polaroid, index) => (
				<motion.div
					key={polaroid.image.src}
					className="absolute right-0 top-0 h-30 w-24 origin-top-right overflow-hidden rounded-xs bg-white shadow-[0px_4px_18px_2px_rgba(93,93,93,0.25),0px_0px_4px_rgba(0,0,0,0.18)]"
					variants={{
						rest: {
							x: polaroid.rest.x,
							y: polaroid.rest.y,
							rotate: polaroid.rest.rotate,
							scale: 0.9,
						},
						hover: {
							x: polaroid.hover.x,
							y: polaroid.hover.y,
							rotate: polaroid.hover.rotate,
							scale: 0.9,
						},
					}}
					transition={shouldReduceMotion ? { duration: 0 } : transition}
					aria-hidden={index > 0 ? "true" : undefined}
				>
					<div className="m-[5px] h-[86px] w-[86px] overflow-hidden bg-gray-200">
						<img
							src={polaroid.image.src}
							alt={`Snap ${index + 1}`}
							width={polaroid.image.width}
							height={polaroid.image.height}
							className="h-full w-full object-cover rounded-[1px]"
							loading="lazy"
							decoding="async"
						/>
					</div>
				</motion.div>
			))}
		</motion.div>
	);
}
