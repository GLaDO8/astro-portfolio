import { useSound } from "@web-kits/audio/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

type NoonPortfolioButtonProps = {
	readonly children: ReactNode;
	readonly href: string;
};

export default function NoonPortfolioButton({ children, href }: NoonPortfolioButtonProps) {
	const playButtonClickSound = useSound({
		source: { type: "sine", frequency: 1200 },
		envelope: { decay: 0.03 },
		gain: 0.3,
	});

	return (
		<motion.a
			transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
			whileHover={{ scale: 1.1, rotate: -1.5 }}
			whileTap={{ scale: 1.05 }}
			onClick={playButtonClickSound}
			href={href}
			data-noon-portfolio-button
			className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-[#faffff] from-[68%] to-[#fcfff1] px-6 pb-2 pt-1.5 font-sans text-base font-semibold tracking-normal text-primary shadow-[0px_0px_8px_0px_rgba(88,104,110,0.15),inset_0px_2px_0px_0px_white] md:px-7 md:pb-2.5 md:pt-2 md:text-xl"
		>
			{children}
		</motion.a>
	);
}
