import { motion, useReducedMotion } from "motion/react";
import callipers from "@/assets/widgets/callipers.webp";
import hammer from "@/assets/widgets/hammer.webp";
import mat from "@/assets/widgets/mat.webp";
import pencil from "@/assets/widgets/pencil.webp";
import rpi from "@/assets/widgets/rpi.webp";
import sdcard from "@/assets/widgets/sdcard.webp";

const toolTransition = {
	type: "spring",
	visualDuration: 0.25,
	bounce: 0.5,
} as const;

const tools = [
	{
		src: pencil,
		alt: "",
		className: "left-3 top-28 z-20 w-23 origin-center",
		rest: { x: 0, y: 0, rotate: 50 },
		hover: { x: -16, y: -20, rotate: 42 },
	},
	{
		src: callipers,
		alt: "",
		className: "left-19 top-11 z-30 w-32 origin-center",
		rest: { x: -20, y: 40, rotate: 74 },
		hover: { x: -20, y: -10, rotate: 80 },
	},
	{
		src: hammer,
		alt: "",
		className: "left-33 top-17 z-20 w-31 origin-center",
		rest: { x: 0, y: 10, rotate: 88 },
		hover: {
			x: 10,
			y: -30,
			rotate: 95,
		},
	},
	{
		src: sdcard,
		alt: "",
		className: "left-28 top-28 z-30 w-22 origin-center scale-[0.2]",
		rest: { x: 30, y: 70, rotate: -10 },
		hover: { x: 80, y: -80, rotate: 2 },
	},
	{
		src: rpi,
		alt: "",
		className: "left-11 top-34 z-30 w-34 origin-center scale-[0.45]",
		rest: { x: -50, y: -10, rotate: -8 },
		hover: { x: -40, y: -40, rotate: -16 },
	},
] as const;

export default function SidequestWidget() {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			className="relative h-64 w-64 shrink-0 cursor-pointer pt-4"
			initial="rest"
			animate="rest"
			whileHover={shouldReduceMotion ? undefined : "hover"}
			transition={toolTransition}
			aria-label="Sidequests"
		>
			<motion.div
				className="absolute left-2 top-20 z-10 w-56 origin-center rotate-[5deg]"
				variants={{
					rest: { scale: 1 },
					hover: { scale: 1.04, rotate: -9 },
				}}
				transition={toolTransition}
			>
				<img
					src={mat.src}
					alt=""
					width={mat.width}
					height={mat.height}
					className="h-auto w-full rounded-sm bg-white object-cover p-1.5 shadow-[0_12px_30px_rgba(42,35,29,0.2),0_0_4px_rgba(122,122,122,0.2)] scale-[0.95]"
					draggable={false}
				/>
				<p className="absolute -bottom-7 left-18 z-40 font-sans text-sm font-semibold text-primary">
					Sidequests
				</p>
			</motion.div>

			{tools.map((tool) => (
				<motion.img
					key={tool.src.src}
					src={tool.src.src}
					alt={tool.alt}
					width={tool.src.width}
					height={tool.src.height}
					className={`pointer-events-none absolute select-none drop-shadow-[0_5px_5px_rgba(42,35,29,0.18)] ${tool.className}`}
					variants={{
						rest: tool.rest,
						hover: tool.hover,
					}}
					transition={toolTransition}
					draggable={false}
				/>
			))}
		</motion.div>
	);
}
