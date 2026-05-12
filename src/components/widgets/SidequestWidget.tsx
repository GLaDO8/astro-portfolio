import { motion, useReducedMotion } from "motion/react";
import callipers from "@/assets/widgets/callipers.png";
import hammer from "@/assets/widgets/hammer.png";
import mat from "@/assets/widgets/mat.png";
import pencil from "@/assets/widgets/pencil.png";

const toolTransition = {
	type: "spring",
	visualDuration: 0.28,
	bounce: 0.45,
} as const;

const tools = [
	{
		src: pencil,
		alt: "",
		className: "left-3 top-28 z-20 w-23 origin-center",
		rest: { x: 0, y: 0, rotate: 50 },
		hover: { x: -16, y: -8, rotate: 42 },
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
		rest: { x: 0, y: 0, rotate: 88 },
		hover: { x: 18, y: -13, rotate: 99 },
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
			</motion.div>

			{tools.map((tool) => (
				<motion.img
					key={tool.src.src}
					src={tool.src.src}
					alt={tool.alt}
					width={tool.src.width}
					height={tool.src.height}
					className={`pointer-events-none absolute select-none ${tool.className}`}
					variants={{
						rest: tool.rest,
						hover: tool.hover,
					}}
					transition={toolTransition}
					draggable={false}
				/>
			))}

			<p className="absolute -bottom-2 left-20 z-40 rotate-[5deg] font-sans text-sm font-semibold text-primary">
				Sidequests
			</p>
		</motion.div>
	);
}
