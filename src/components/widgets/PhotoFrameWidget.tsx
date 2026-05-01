import { motion } from "motion/react";
import halftone from "@/assets/widgets/halftone-photo.webp";
import postItMe from "@/assets/widgets/postit-me.svg";

export default function PhotoFrameWidget() {
	return (
		<motion.div
			className="relative shrink-0 pt-2 scale-105"
			transition={{ type: "spring", visualDuration: 0.25, bounce: 0.5 }}
			whileHover={{ scale: 1.1, rotate: -12 }}
		>
			<img
				src={halftone.src}
				alt="Shreyas in a scuba dive suit, smiling"
				width={halftone.width}
				height={halftone.height}
				loading="eager"
				className="-rotate-3 h-34 w-40 rounded-sm bg-white object-cover p-1.25 shadow-[0_12px_30px_rgba(42,35,29,0.14),0_0_4px_rgba(122,122,122,0.18)]"
				draggable={false}
			/>
			<div className="absolute -right-6 -bottom-12 -rotate-8 scale-[0.7]">
				<img
					src={postItMe.src}
					alt="Post-it note saying Me!"
					width={postItMe.width}
					height={postItMe.height}
				/>
			</div>
		</motion.div>
	);
}
