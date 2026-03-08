import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { scrollVelocity } from "@/lib/scroll-velocity";
import { useSpringConfig } from "@/lib/spring-config";

const POLAROIDS = [
	{ rotate: 23.83, tx: 257.6, ty: -34.2 },
	{ rotate: -17.18, tx: 140.7, ty: 12.9 },
	{ rotate: 10.45, tx: 200.9, ty: 45.3 },
] as const;

// Fan-out targets on hover (rotation offset + translate offset)
const FAN_TARGETS = [
	{ rotate: 35, tx: 270, ty: -50 },
	{ rotate: -30, tx: 110, ty: 5 },
	{ rotate: 18, tx: 225, ty: 60 },
] as const;

function InstantPhoto({
	baseRotate,
	baseTx,
	baseTy,
	fanRotate,
	fanTx,
	fanTy,
	isHovered,
	index,
	fanConfig,
}: {
	baseRotate: number;
	baseTx: number;
	baseTy: number;
	fanRotate: number;
	fanTx: number;
	fanTy: number;
	isHovered: boolean;
	index: number;
	fanConfig: { stiffness: number; damping: number; mass: number };
}) {
	const scrollShift = useMotionValue(0);
	const springShift = useSpring(scrollShift, fanConfig);

	const targetRotate = useMotionValue(baseRotate);
	const targetTx = useMotionValue(baseTx);
	const targetTy = useMotionValue(baseTy);

	const springRotate = useSpring(targetRotate, {
		...fanConfig,
		// Stagger: higher index = slightly slower response
		damping: fanConfig.damping + index * 2,
	});
	const springTx = useSpring(targetTx, fanConfig);
	const springTy = useSpring(targetTy, fanConfig);

	// Combine spring position with scroll shuffle
	const finalTx = useTransform(
		[springTx, springShift],
		([tx, shift]: number[]) => tx + shift,
	);

	useEffect(() => {
		if (isHovered) {
			targetRotate.set(fanRotate);
			targetTx.set(fanTx);
			targetTy.set(fanTy);
		} else {
			targetRotate.set(baseRotate);
			targetTx.set(baseTx);
			targetTy.set(baseTy);
		}
	}, [
		isHovered,
		baseRotate,
		baseTx,
		baseTy,
		fanRotate,
		fanTx,
		fanTy,
		targetRotate,
		targetTx,
		targetTy,
	]);

	// Scroll velocity → shuffle shift
	useEffect(() => {
		let rafId: number;
		function update() {
			const sv = scrollVelocity.get();
			scrollShift.set(sv * 0.3 * (index + 1));
			rafId = requestAnimationFrame(update);
		}
		rafId = requestAnimationFrame(update);
		return () => cancelAnimationFrame(rafId);
	}, [scrollShift, index]);

	return (
		<motion.div
			className="absolute w-[96px] h-[120px] bg-white origin-[0%_0%] overflow-hidden"
			style={{
				rotate: springRotate,
				x: finalTx,
				y: springTy,
				boxShadow:
					"0px 4px 18px 2px rgba(93, 93, 93, 0.25), 0px 0px 4px rgba(0, 0, 0, 0.18)",
			}}
		>
			{/* Inner photo area */}
			<div className="m-[5px] w-[86px] h-[86px] bg-gray-200 rounded-[2px] overflow-hidden">
				<img
					src={`https://picsum.photos/seed/snap${index}/86/86`}
					alt={`Snap ${index + 1}`}
					className="w-full h-full object-cover"
				/>
			</div>
		</motion.div>
	);
}

export default function SnapsWidget() {
	const [isHovered, setIsHovered] = useState(false);
	const fanConfig = useSpringConfig("polaroidFan");

	return (
		<div
			className="w-[300px] h-[200px] rounded-[16px] shrink-0 relative bg-snaps-bg shadow-[color(display-p3_0.608_0.657_0.681)_0px_2px_32px_4px] overflow-visible cursor-pointer"
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
		>
			<span className="absolute left-[33px] top-[26px] font-inter font-bold text-[30px] leading-[36px] tracking-[-0.02em] text-[color(display-p3_0.121_0.153_0.016)]">
				Snaps
			</span>
			<span className="absolute left-[32px] top-[128px] font-inter font-bold text-[12px] leading-[16px] tracking-[-0.02em] text-green-dark">
				Fuji X100V
				<br />
				iPhone
				<br />
				Kodak Charmera
			</span>
			{POLAROIDS.map((p, i) => (
				<InstantPhoto
					key={p.rotate}
					baseRotate={p.rotate}
					baseTx={p.tx}
					baseTy={p.ty}
					fanRotate={FAN_TARGETS[i].rotate}
					fanTx={FAN_TARGETS[i].tx}
					fanTy={FAN_TARGETS[i].ty}
					isHovered={isHovered}
					index={i}
					fanConfig={fanConfig}
				/>
			))}
		</div>
	);
}
