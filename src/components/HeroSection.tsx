import { useSound } from "@web-kits/audio/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import shuffled from "@/lib/fisher-shuffle";

type Description = {
	text: string;
	mobileText: string;
};

const descriptions: Description[] = [
	{
		text: "Shreyas is a design engineer and a serial hobbyist.",
		mobileText: "Shreyas is a design\nengineer and a serial\nhobbyist.",
	},
	{
		text: "Shreyas is a professional kitty psspss-er with a 3D printer.",
		mobileText: "Shreyas is a professional\nkitty psspss-er with\na 3D printer.",
	},
	{
		text: "Shreyas writes poetry with his Fujifilm and has five tattoos.",
		mobileText: "Shreyas writes poetry\nwith his Fujifilm\nand has five tattoos.",
	},
	{
		text: "Shreyas collects vinyls & builds mechanical keyboards.",
		mobileText: "Shreyas collects vinyls\n& builds mechanical\nkeyboards.",
	},
	{
		text: "Shreyas keeps a tiny home server and shares rent with two cats.",
		mobileText: "Shreyas keeps a tiny\nhome server and shares\nrent with two cats.",
	},
	{
		text: "Shreyas calls himself an audiophile but uses Airpods.",
		mobileText: "Shreyas calls himself\nan audiophile but\nuses Airpods.",
	},
	{
		text: "Shreyas doesn't like drinking but steals coasters from bars.",
		mobileText: "Shreyas doesn't like\ndrinking but steals\ncoasters from bars.",
	},
	{
		text: "Shreyas loves monospace fonts but you won't find any here.",
		mobileText: "Shreyas loves monospace\nfonts but you won't\nfind any here.",
	},
];

const STREAM_LETTER_DELAY = 0.007;
const STREAM_LETTER_DURATION = 0.1;
const TIGHT_KERNING_PAIR_CLASSES: Record<string, string> = {
	ya: "-ml-[0.08em]",
};

type StreamingTextProps = {
	text: string;
	mobileText: string;
	shouldReduceMotion: boolean;
};

function getStreamingWords(text: string) {
	let letterIndex = 0;
	const words = text.split(/(\n| )/);

	return words.map((word) => ({
		word,
		key: `${word}-${letterIndex}`,
		letters: Array.from(word).map((letter, index, letters) => {
			const pair = `${letters[index - 1] ?? ""}${letter}`.toLowerCase();

			return {
				letter,
				key: `${letter}-${letterIndex}`,
				delay: letterIndex++ * STREAM_LETTER_DELAY,
				kerningClassName: TIGHT_KERNING_PAIR_CLASSES[pair],
			};
		}),
	}));
}

function renderReducedMotionText(text: string) {
	return text.split("\n").map((line, index, lines) => (
		<Fragment key={lines.slice(0, index + 1).join("\n")}>
			{line}
			{index < lines.length - 1 ? <br /> : null}
		</Fragment>
	));
}

function StreamingText({ text, mobileText, shouldReduceMotion }: StreamingTextProps) {
	if (shouldReduceMotion) {
		return (
			<>
				<motion.span
					key={`mobile-${mobileText}`}
					className="inline whitespace-nowrap text-primary md:hidden"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16 }}
				>
					{renderReducedMotionText(mobileText)}
				</motion.span>
				<motion.span
					key={`desktop-${text}`}
					className="hidden text-primary md:inline"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16 }}
				>
					{text}
				</motion.span>
			</>
		);
	}

	const words = getStreamingWords(text);
	const mobileWords = getStreamingWords(mobileText);

	return (
		<>
			<StreamingWords
				key={`mobile-${mobileText}`}
				className="inline whitespace-nowrap md:hidden"
				text={mobileText}
				words={mobileWords}
			/>
			<StreamingWords
				key={`desktop-${text}`}
				className="hidden md:inline"
				text={text}
				words={words}
			/>
		</>
	);
}

type StreamingWordsProps = {
	className: string;
	text: string;
	words: ReturnType<typeof getStreamingWords>;
};

function StreamingWords({ className, text, words }: StreamingWordsProps) {
	return (
		<motion.span
			className={cn("text-primary", className)}
			aria-label={text.replace(/\n/g, " ")}
			exit={{ opacity: 0, y: -4 }}
			transition={{ duration: 0.08, ease: "easeOut" }}
		>
			{words.map(({ word, key, letters }) => {
				if (word === "\n") {
					return <br key={key} aria-hidden="true" />;
				}

				if (word === " ") {
					return " ";
				}

				return (
					<span key={key} aria-hidden="true" className="inline-block whitespace-nowrap">
						{letters.map(({ key: letterKey, letter, delay, kerningClassName }) => (
							<motion.span
								key={letterKey}
								className={cn("inline-block", kerningClassName)}
								initial={{ opacity: 0, y: "0.35em", filter: "blur(8px)" }}
								animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
								transition={{
									duration: STREAM_LETTER_DURATION,
									delay,
									ease: "easeOut",
								}}
							>
								{letter}
							</motion.span>
						))}
					</span>
				);
			})}
		</motion.span>
	);
}

export default function HeroSection() {
	const shouldReduceMotion = useReducedMotion();
	const bagRef = useRef<Description[]>([]);
	const playButtonClickSound = useSound({
		source: { type: "sine", frequency: 1200 },
		envelope: { decay: 0.03 },
		gain: 0.18,
	});
	const [description, setDescription] = useState(descriptions[0]);

	const cycle = useCallback(() => {
		playButtonClickSound();

		if (bagRef.current.length === 0) {
			bagRef.current = shuffled(descriptions.filter((item) => item.text !== description.text));
		}

		const nextDescription = bagRef.current.pop();
		if (nextDescription) {
			setDescription(nextDescription);
		}
	}, [playButtonClickSound, description.text]);

	return (
		<section className="flex w-full flex-col items-center gap-6 text-center">
			<h1
				data-hero-rotating-text
				className="m-0 box-border h-[3.9em] w-screen overflow-hidden text-center font-sans text-hero-mobile leading-[1.3] font-bold tracking-[-0.02em] text-primary uppercase md:h-auto md:max-w-6xl md:px-4 md:text-5xl md:leading-[1.25] md:[word-spacing:0.08em] xl:text-6xl"
			>
				{/* initial={false} skips animation on the first render */}
				<AnimatePresence mode="wait" initial={false}>
					<StreamingText
						key={description.text}
						text={description.text}
						mobileText={description.mobileText}
						shouldReduceMotion={Boolean(shouldReduceMotion)}
					/>
				</AnimatePresence>
			</h1>

			<div className="flex flex-wrap items-center justify-center gap-6">
				<motion.button
					transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
					whileHover={{ scale: 1.1, rotate: -1.5 }}
					whileTap={{ scale: 1.05 }}
					type="button"
					onClick={cycle}
					className="cursor-pointer rounded-full bg-gradient-to-b from-[#faffff] from-[68%] to-[#fcfff1] px-4 pb-1.75 pt-1.5 md:px-6 md:pb-2.5 md:pt-2 font-sans text-base font-semibold tracking-[-0.02em] text-primary shadow-[0px_0px_8px_0px_rgba(88,104,110,0.15),inset_0px_2px_0px_0px_white] md:text-xl"
				>
					What else ?
				</motion.button>

				<div className="flex gap-4 md:gap-5">
					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://github.com/GLaDO8"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary/80 hover:text-primary"
					>
						<svg
							className="size-5 md:size-6"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-label="GitHub"
						>
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
						</svg>
					</motion.a>

					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://x.com/wutamelonshrey"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary/80 hover:text-primary"
					>
						<svg
							className="size-5 md:size-6"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-label="X"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</motion.a>

					<motion.a
						transition={{ type: "spring", visualDuration: 0.2, bounce: 0.5 }}
						whileHover={{ scale: 1.2 }}
						href="https://www.instagram.com/wutamelonshrey/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary/80 hover:text-primary"
					>
						<svg
							className="size-5 md:size-6"
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
