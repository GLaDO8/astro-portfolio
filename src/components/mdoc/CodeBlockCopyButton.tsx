import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface CodeBlockCopyButtonProps {
	code: string;
}

const copiedResetDelay = 1600;
const copyIconSrc = "/Copy.svg";

async function writeToClipboard(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	textarea.style.top = "0";
	document.body.append(textarea);
	textarea.select();
	document.execCommand("copy");
	textarea.remove();
}

function CopyIcon() {
	return (
		<motion.img
			src={copyIconSrc}
			alt=""
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 size-4 object-contain"
			draggable={false}
			initial={{ scale: 0 }}
			animate={{ scale: 1 }}
			exit={{ scale: 0 }}
			transition={{
				scale: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
			}}
		/>
	);
}

function CheckIcon() {
	return (
		<motion.svg
			className="pointer-events-none absolute inset-0 size-3.5"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.9"
			strokeLinecap="round"
			strokeLinejoin="round"
			initial={{ scale: 0 }}
			animate={{ scale: 1 }}
			exit={{ scale: 0 }}
			transition={{
				scale: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
			}}
		>
			<path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
		</motion.svg>
	);
}

export default function CodeBlockCopyButton({ code }: CodeBlockCopyButtonProps) {
	const [copied, setCopied] = useState(false);
	const resetTimerRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		return () => {
			if (resetTimerRef.current) {
				window.clearTimeout(resetTimerRef.current);
			}
		};
	}, []);

	async function handleCopy() {
		if (!code) {
			return;
		}

		try {
			await writeToClipboard(code);
			setCopied(true);

			if (resetTimerRef.current) {
				window.clearTimeout(resetTimerRef.current);
			}

			resetTimerRef.current = window.setTimeout(() => {
				setCopied(false);
				resetTimerRef.current = undefined;
			}, copiedResetDelay);
		} catch {
			setCopied(false);
		}
	}

	const controlLabel = copied ? "Code copied" : "Copy code";

	return (
		<button
			type="button"
			className="absolute top-2 right-2 z-10 grid size-7 cursor-pointer place-items-center rounded-sm border border-charcoal/10 bg-white text-charcoal transition duration-200 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
			aria-label={controlLabel}
			title={controlLabel}
			onClick={handleCopy}
			data-codeblock-copy-button
		>
			<span className="relative block size-4" aria-hidden="true">
				<AnimatePresence initial={false}>
					{copied ? <CheckIcon key="check" /> : <CopyIcon key="copy" />}
				</AnimatePresence>
			</span>
		</button>
	);
}
