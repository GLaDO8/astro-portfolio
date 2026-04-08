import { motion, useReducedMotion } from "motion/react";

interface Props {
	src: string;
	alt?: string;
}

export default function PhotoFrameWidget({ src, alt = "Photo" }: Props) {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			className="relative h-56 w-60 shrink-0 md:h-64 md:w-64"
			whileHover={shouldReduceMotion ? undefined : { rotate: -4 }}
			transition={{ type: "spring", stiffness: 600, damping: 20 }}
		>
			<img
				src={src}
				alt={alt}
				className="block h-[84%] w-[84%] -rotate-6 rounded-sm bg-white object-cover p-1.5 shadow-[0_12px_30px_rgba(42,35,29,0.14)]"
			/>
			<div className="absolute left-34 top-31 -rotate-8 md:left-36 md:top-34">
				<img src="/postit-me.svg" alt="Post-it note saying Me!" width={86} height={113} />
			</div>
		</motion.div>
	);
}
