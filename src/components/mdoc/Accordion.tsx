import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import { articleProseClass } from "@/lib/articleProse";
import minusIconSvg from "/minus.svg?raw";
import plusIconSvg from "/Plus.svg?raw";

interface AccordionProps {
	title: string;
	subtitle?: string;
	children?: ReactNode;
}
const PLUS_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(plusIconSvg)}`;
const MINUS_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(minusIconSvg)}`;
const defaultSubtitle = "Click to read more about this";
const collapsedSubtitle = "Click again to collapse this section";
const panelVariants = {
	open: { height: "auto" },
	closed: { height: 0 },
};
const bodyVariants = {
	open: { opacity: 1, y: 0 },
	closed: { opacity: 0, y: -8 },
};
const accordionContentClassName = [articleProseClass, "max-w-none px-6 pb-6"].join(" ");

export default function Accordion({ title, subtitle = defaultSubtitle, children }: AccordionProps) {
	const shouldReduceMotion = useReducedMotion();
	const [isOpen, setIsOpen] = useState(false);
	const titleId = useId();
	const contentId = useId();
	const motionState = isOpen ? "open" : "closed";

	function toggleAccordion() {
		setIsOpen((open) => !open);
	}

	return (
		<motion.section
			layout={!shouldReduceMotion}
			className="my-8 overflow-hidden rounded-lg border border-primary/10 bg-white"
		>
			<button
				type="button"
				id={titleId}
				aria-expanded={isOpen}
				aria-controls={contentId}
				onClick={toggleAccordion}
				className="not-prose flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
			>
				<div className="flex flex-col gap-2.5">
					<p className="font-sans text-lg font-bold text-[#da0288]">{title}</p>
					<p className="font-sans text-base text-[#70787e]">
						{isOpen ? collapsedSubtitle : subtitle}
					</p>
				</div>
				<motion.div
					className="size-8 shrink-0 rounded-full bg-[#fbe5f3]"
					whileHover={{ scale: 1.15 }}
					transition={{
						scale: { type: "spring", visualDuration: 0.15, bounce: 0.4 },
					}}
				>
					<span className="relative block size-8">
						<AnimatePresence initial={false}>
							<motion.img
								key={isOpen ? "plus" : "minus"}
								src={isOpen ? MINUS_ICON_SRC : PLUS_ICON_SRC}
								alt=""
								aria-hidden="true"
								className="size-5 text-[#da0288] absolute inset-0 m-auto"
								draggable={false}
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								exit={{ scale: 0 }}
								transition={{
									scale: { type: "spring", visualDuration: 0.2, bounce: 0.4 },
								}}
							></motion.img>
						</AnimatePresence>
					</span>
				</motion.div>
			</button>

			<motion.div
				id={contentId}
				role="region"
				aria-labelledby={titleId}
				aria-hidden={!isOpen}
				initial={false}
				animate={motionState}
				variants={panelVariants}
				className="overflow-hidden"
				transition={
					shouldReduceMotion
						? { duration: 0 }
						: {
								duration: 0.3,
								ease: [0.22, 1, 0.36, 1],
							}
				}
			>
				<motion.div
					variants={bodyVariants}
					transition={
						shouldReduceMotion
							? { duration: 0 }
							: {
									duration: 0.16,
									ease: "easeOut",
								}
					}
					className={accordionContentClassName}
				>
					{children}
				</motion.div>
			</motion.div>
		</motion.section>
	);
}
