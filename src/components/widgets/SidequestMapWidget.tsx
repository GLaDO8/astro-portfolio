import { motion, useReducedMotion } from "motion/react";
import mapArtwork from "@/assets/widgets/sidequest-map.png";
import { cn } from "@/lib/cn";

const panelTransition = {
	type: "spring" as const,
	duration: 0.3,
	bounce: 0,
};

const panelTransforms = [
	{
		id: "west-cover",
		rest: { rotateY: 45, x: 0, z: 0 },
		hover: { rotateY: 0, x: 0, z: 0 },
		origin: "right center",
	},
	{
		id: "west-fold",
		rest: { rotateY: -45, x: -2, z: 8 },
		hover: { rotateY: 0, x: 0, z: 0 },
		origin: "left center",
	},
	{
		id: "east-fold",
		rest: { rotateY: 45, x: 2, z: 8 },
		hover: { rotateY: 0, x: 0, z: 0 },
		origin: "right center",
	},
	{
		id: "east-cover",
		rest: { rotateY: -45, x: 0, z: 0 },
		hover: { rotateY: 0, x: 0, z: 0 },
		origin: "left center",
	},
] as const;

const mapHalves = [
	{
		id: "west-half",
		panels: panelTransforms.slice(0, 2),
		rest: { x: 19 },
		hover: { x: 0 },
	},
	{
		id: "east-half",
		panels: panelTransforms.slice(2),
		rest: { x: -19 },
		hover: { x: 0 },
	},
] as const;

export default function SidequestMapWidget() {
	const shouldReduceMotion = useReducedMotion();
	const initialState = shouldReduceMotion ? "hover" : "rest";

	return (
		<motion.div
			className="relative h-34 w-58 shrink-0 cursor-pointer [perspective:700px]"
			initial={initialState}
			animate={initialState}
			whileHover={shouldReduceMotion ? undefined : "hover"}
			aria-label="Sidequests"
		>
			<motion.div
				className="flex h-full w-full items-stretch justify-center [filter:drop-shadow(0_10px_18px_rgba(42,35,29,0.18))_drop-shadow(0_0_4px_rgba(122,122,122,0.18))] [transform-style:preserve-3d]"
				variants={{
					rest: { rotate: 4, scale: 0.96, y: 0 },
					hover: { rotate: -2, scale: 1.04, y: -2 },
				}}
				transition={panelTransition}
			>
				{mapHalves.map((half, halfIndex) => (
					<motion.div
						key={half.id}
						className="flex h-full w-1/2 items-stretch [transform-style:preserve-3d]"
						variants={{ rest: half.rest, hover: half.hover }}
						transition={panelTransition}
					>
						{half.panels.map((panel, panelIndex) => {
							const index = halfIndex * 2 + panelIndex;

							return (
								<motion.div
									key={panel.id}
									className={cn(
										"relative h-full w-1/2 bg-white py-1 [backface-visibility:hidden]",
										index === 0 && "rounded-l-[3px] pl-1",
										index === panelTransforms.length - 1 && "rounded-r-[3px] pr-1",
									)}
									style={{ transformOrigin: panel.origin }}
									variants={{ rest: panel.rest, hover: panel.hover }}
									transition={panelTransition}
								>
									<div
										className={cn(
											"h-full w-full overflow-hidden bg-cover bg-no-repeat",
											index === 0 && "rounded-l-[1px]",
											index === panelTransforms.length - 1 && "rounded-r-[1px]",
										)}
										style={{
											backgroundImage: `url(${mapArtwork.src})`,
											backgroundPosition: `${(index / (panelTransforms.length - 1)) * 100}% center`,
											backgroundSize: "400% 100%",
										}}
									/>
								</motion.div>
							);
						})}
					</motion.div>
				))}
			</motion.div>
			<div className="absolute -bottom-8 left-1/2 -translate-x-1/2 rotate-[-5deg]">
				<p className="whitespace-nowrap font-sans font-semibold text-primary text-sm">
					Side quests
				</p>
			</div>
		</motion.div>
	);
}
