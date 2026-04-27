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

interface Props {
	variant?: "card" | "compact";
}

const compactPolaroids = [
	{
		image: snapOne,
		className: "left-[4.4rem] top-0 rotate-[-3deg]",
		hover: { x: 5, y: -8, rotate: 1 },
	},
	{
		image: snapTwo,
		className: "left-0 top-[3.2rem] rotate-[-24deg]",
		hover: { x: -8, y: -6, rotate: -30 },
	},
	{
		image: snapThree,
		className: "left-[5.2rem] top-[4.4rem] rotate-[5deg]",
		hover: { x: 8, y: -4, rotate: 10 },
	},
] as const;

export default function SnapsWidget({ variant = "card" }: Props) {
	const shouldReduceMotion = useReducedMotion();

	if (variant === "compact") {
		return (
			<motion.div
				className="relative h-[11.75rem] w-[9.5rem] shrink-0 cursor-pointer"
				initial="rest"
				animate="rest"
				whileHover={shouldReduceMotion ? undefined : "hover"}
				aria-label="Photo Roll"
			>
				{compactPolaroids.map((polaroid, index) => (
					<motion.div
						key={polaroid.image.src}
						className={`absolute h-[6rem] w-[4.95rem] rounded-[2px] bg-white p-1 shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_4px_rgba(122,122,122,0.2)] ${polaroid.className}`}
						variants={{
							rest: { x: 0, y: 0 },
							hover: polaroid.hover,
						}}
						transition={shouldReduceMotion ? { duration: 0 } : transition}
						aria-hidden={index > 0 ? "true" : undefined}
					>
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

				<div className="absolute left-[4.7rem] top-[7.8rem] rotate-[-10deg] bg-[#f5e95c] px-2 py-0.5 font-sans text-xs font-medium tracking-[-0.02em] text-charcoal shadow-[0_1px_2px_rgba(42,35,29,0.14)]">
					Stockholm
				</div>

				<div className="absolute bottom-0 left-[3.6rem] flex rotate-[6deg] items-center gap-1.5">
					<span className="font-sans text-sm font-semibold tracking-[-0.02em] text-charcoal">
						Photo Roll
					</span>
					<span
						aria-hidden="true"
						className="flex size-4 items-center justify-center rounded-full bg-mist text-charcoal/55"
					>
						<svg aria-hidden="true" className="size-2.5 -rotate-90" viewBox="0 0 16 16" fill="none">
							<path
								d="M4 6.25L8 10.25L12 6.25"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</span>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			className="relative flex h-40 shrink-0 overflow-hidden rounded-xl bg-white border-2 border-[#E7E9E1] cursor-pointer sm:overflow-visible"
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
