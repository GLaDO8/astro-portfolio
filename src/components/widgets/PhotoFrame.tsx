import { motion, useMotionValue, useSpring } from "motion/react";
import { useSpringConfig } from "@/lib/spring-config";
import PostItNote from "./PostItNote";

interface PhotoFrameProps {
	src: string;
	alt?: string;
}

export default function PhotoFrame({ src, alt = "Photo" }: PhotoFrameProps) {
	const frameConfig = useSpringConfig("photoFrameTilt");
	const rotateX = useMotionValue(0);
	const rotateY = useMotionValue(0);

	const springX = useSpring(rotateX, frameConfig);
	const springY = useSpring(rotateY, frameConfig);

	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		// Map pointer position to subtle tilt (-4 to +4 degrees)
		rotateY.set(((e.clientX - centerX) / (rect.width / 2)) * 4);
		rotateX.set(((e.clientY - centerY) / (rect.height / 2)) * -4);
	}

	function handlePointerLeave() {
		rotateX.set(0);
		rotateY.set(0);
	}

	return (
		<motion.div
			className="w-[300px] h-[200px] shrink-0 relative"
			style={{
				rotateX: springX,
				rotateY: springY,
				transformPerspective: 800,
			}}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
		>
			<div className="w-full h-full rounded-[16px] overflow-hidden bg-halftone-base shadow-[color(display-p3_0.608_0.657_0.681)_0px_2px_32px_4px]">
				<img
					src={src}
					alt={alt}
					className="w-full h-full object-cover contrast-[1.2] grayscale-[0.15]"
				/>
			</div>
			<PostItNote />
		</motion.div>
	);
}
