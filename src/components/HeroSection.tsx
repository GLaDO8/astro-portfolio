import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";

const descriptions = [
	"is a software designer with way too many side quests.",
	"is a professional kitty psspss-er with a 3D printer.",
	"writes poetry with his Fujifilm and has five tattoos.",
	"collects vinyls and spends too much on mechanical keyboards.",
	"keeps a tiny home server and shares rent with two cats.",
	"likes calling himself an audiophile but uses Airpods.",
	"doesn't like drinking but steals coasters from bars.",
	"loves monospace fonts but you won't find any here.",
];

// Uses the shuffle bag algorithm by Fisher-Yates. Bag starts empty, adds all descriptions and then pops them till it's empty again.
function shuffled(arr: string[]) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export default function HeroSection() {
	const shouldReduceMotion = useReducedMotion();
	const bagRef = useRef<string[]>([]);
	const [text, setText] = useState(descriptions[0]);

	const cycle = useCallback(() => {
		if (bagRef.current.length === 0) {
			bagRef.current = shuffled(descriptions.filter((description) => description !== text));
		}

		const nextText = bagRef.current.pop();
		if (nextText) {
			setText(nextText);
		}
	}, [text]);

	return (
		<section className="w-full flex flex-col items-start gap-6">
			<h1 className="m-0 text-pretty font-sans text-2xl leading-[1.4] font-semibold tracking-[-0.01em] text-charcoal">
				<span className="whitespace-nowrap text-charcoal font-semibold">Shreyas&nbsp;</span>
				{/* initial={false} skips animation on the first render */}
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={text}
						className="inline text-charcoal"
						initial={
							shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(8px)" }
						}
						animate={
							shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
						}
						exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(8px)" }}
						transition={
							shouldReduceMotion
								? { duration: 0.2 }
								: {
										type: "spring",
										stiffness: 300,
										damping: 18,
										mass: 1,
										opacity: { duration: 0.2 },
										filter: { duration: 0.2 },
									}
						}
					>
						{text}
					</motion.span>
				</AnimatePresence>
			</h1>

			<div className="flex gap-6 items-center">
				<motion.button
					transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
					whileHover={{ scale: 1.1, rotate: -1.5 }}
					whileTap={{ scale: 1.05 }}
					type="button"
					onClick={cycle}
					className="cursor-pointer rounded-full bg-gradient-to-b from-[#faffff] from-[68%] to-[#fcfff1] px-5 pb-1.75 pt-1.25 font-sans text-base font-semibold tracking-[-0.02em] text-charcoal shadow-[0px_0px_8px_0px_rgba(88,104,110,0.15),inset_0px_2px_0px_0px_white]"
				>
					What else ?
				</motion.button>

				<div className="flex gap-4">
					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://github.com/GLaDO8"
						target="_blank"
						rel="noopener noreferrer"
						className="text-charcoal"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
						</svg>
					</motion.a>

					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://x.com/wutamelonshrey"
						target="_blank"
						rel="noopener noreferrer"
						className="text-charcoal"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="X">
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</motion.a>

					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://www.instagram.com/wutamelonshrey/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-charcoal"
					>
						<svg
							width="20"
							height="20"
							viewBox="4 4 24 24"
							fill="currentColor"
							aria-label="Instagram"
						>
							<path d="M22.3,8.4c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4c0.8,0,1.4-0.6,1.4-1.4C23.7,9,23.1,8.4,22.3,8.4z" />
							<path d="M16,10.2c-3.3,0-5.9,2.7-5.9,5.9s2.7,5.9,5.9,5.9s5.9-2.7,5.9-5.9S19.3,10.2,16,10.2z M16,19.9c-2.1,0-3.8-1.7-3.8-3.8c0-2.1,1.7-3.8,3.8-3.8c2.1,0,3.8,1.7,3.8,3.8C19.8,18.2,18.1,19.9,16,19.9z" />
							<path d="M20.8,4h-9.5C7.2,4,4,7.2,4,11.2v9.5c0,4,3.2,7.2,7.2,7.2h9.5c4,0,7.2-3.2,7.2-7.2v-9.5C28,7.2,24.8,4,20.8,4z M25.7,20.8c0,2.7-2.2,5-5,5h-9.5c-2.7,0-5-2.2-5-5v-9.5c0-2.7,2.2-5,5-5h9.5c2.7,0,5,2.2,5,5V20.8z" />
						</svg>
					</motion.a>
				</div>
			</div>
		</section>
	);
}
