import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { getMouseState, initMouseTracker } from "@/lib/mouse-tracker";
import { scrollVelocity } from "@/lib/scroll-velocity";
import { useSpringConfig } from "@/lib/spring-config";
import PostItSvg from "./PostItSvg";

interface PostItNoteProps {
	idPrefix?: string;
}

export default function PostItNote({ idPrefix = "postit" }: PostItNoteProps) {
	const isHovered = useRef(false);
	const tiltConfig = useSpringConfig("postItTilt");
	const liftConfig = useSpringConfig("postItLift");

	const tiltTarget = useMotionValue(0);
	const liftTarget = useMotionValue(0);

	const tilt = useSpring(tiltTarget, tiltConfig);
	const lift = useSpring(liftTarget, liftConfig);

	useEffect(() => {
		initMouseTracker();

		let rafId: number;

		function update() {
			const sv = scrollVelocity.get();
			const mouse = getMouseState();

			// Scroll velocity → rotateY sway + mouse vx → flutter
			tiltTarget.set(sv * 0.5 + mouse.vx * 15);

			// Hover → lift up, mouse speed → subtle lift
			const speedLift = Math.min(mouse.speed * 5, 10);
			const hoverLift = isHovered.current ? -8 : 0;
			liftTarget.set(hoverLift - speedLift);

			rafId = requestAnimationFrame(update);
		}

		rafId = requestAnimationFrame(update);
		return () => cancelAnimationFrame(rafId);
	}, [tiltTarget, liftTarget]);

	return (
		<motion.div
			className="absolute left-[216px] top-[127px] cursor-pointer"
			style={{
				rotateY: tilt,
				y: lift,
				transformPerspective: 400,
			}}
			onPointerEnter={() => {
				isHovered.current = true;
			}}
			onPointerLeave={() => {
				isHovered.current = false;
			}}
		>
			<PostItSvg idPrefix={idPrefix} />
		</motion.div>
	);
}
