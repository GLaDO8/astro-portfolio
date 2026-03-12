import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const POLAROIDS = [
	{
		src: "/snaps/DSCF4135-Enhanced-NR-2.webp",
		rotate: 23.83,
		tx: 257.6,
		ty: -34.2,
		fanRotate: 35,
		fanTx: 270,
		fanTy: -50,
	},
	{
		src: "/snaps/DSCF4283.webp",
		rotate: -17.18,
		tx: 140.7,
		ty: 12.9,
		fanRotate: -30,
		fanTx: 110,
		fanTy: 5,
	},
	{
		src: "/snaps/DSCF4449.webp",
		rotate: 10.45,
		tx: 200.9,
		ty: 45.3,
		fanRotate: 18,
		fanTx: 225,
		fanTy: 60,
	},
] as const;

export default function SnapsWidget() {
	const [isHovered, setIsHovered] = useState(false);
	const shouldReduceMotion = useReducedMotion();

	return (
		<div
			className="w-75 h-50 rounded-2xl shadow-lg shrink-0 relative bg-snaps-bg overflow-visible cursor-pointer"
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
			onFocus={() => setIsHovered(true)}
			onBlur={() => setIsHovered(false)}
			tabIndex={0}
			role="group"
			aria-label="Photo snaps"
		>
			{/* Text content — flexbox column */}
			<div className="flex flex-col justify-between h-full p-6">
				<div className="font-sans font-bold text-[30px] leading-9 tracking-[-0.02em] text-[color(display-p3_0.121_0.153_0.016)]">
					Snaps
				</div>
				<div className="font-sans font-bold text-[12px] leading-4 tracking-[-0.02em] text-green-dark">
					Fuji X100V
					<br />
					iPhone
					<br />
					Kodak Charmera
				</div>
			</div>
			<AnimatePresence initial={false}>
				{POLAROIDS.map((p, i) => (
					<motion.div
						key={p.rotate}
						className="absolute top-0 left-0 w-24 h-30 bg-white origin-[0%_0%] overflow-hidden shadow-[0px_4px_18px_2px_rgba(93,93,93,0.25),0px_0px_4px_rgba(0,0,0,0.18)]"
						animate={{
							rotate: isHovered ? p.fanRotate : p.rotate,
							x: isHovered ? p.fanTx : p.tx,
							y: isHovered ? p.fanTy : p.ty,
						}}
						transition={
							shouldReduceMotion
								? { duration: 0 }
								: {
										type: "spring",
										stiffness: 500,
										damping: 32,
										mass: 1,
										rotate: {
											type: "spring",
											stiffness: 500,
											damping: 32,
											mass: 1,
										},
									}
						}
					>
						<div className="m-[5px] w-[86px] h-[86px] bg-gray-200 overflow-hidden">
							<img src={p.src} alt={`Snap ${i + 1}`} className="w-full h-full object-cover" />
						</div>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}
