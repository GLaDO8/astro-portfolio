import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import CheckIcon from "/Check.svg?raw";
import CopyIcon from "/Copy.svg?raw";

interface CodeBlockCopyButtonProps {
	code: string;
}

const copiedResetDelay = 1600;
const COPY_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(CopyIcon)}`;
const CHECK_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(CheckIcon)}`;

async function writeToClipboard(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.className = "fixed top-0 left-[-9999px]";
	textarea.setAttribute("readonly", "");
	document.body.append(textarea);
	textarea.select();
	document.execCommand("copy");
	textarea.remove();
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
			className="absolute top-2 right-2 z-10 grid size-7 cursor-pointer place-items-center rounded-sm border border-primary/10 bg-white text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			aria-label={controlLabel}
			title={controlLabel}
			onClick={handleCopy}
			data-codeblock-copy-button
		>
			<span className="relative block size-4" aria-hidden="true">
				<AnimatePresence initial={false}>
					<motion.img
						key={copied ? "check" : "copy"}
						src={copied ? CHECK_ICON_SRC : COPY_ICON_SRC}
						className="pointer-events-none size-4 absolute inset-0"
						draggable={false}
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0 }}
						transition={{
							scale: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
						}}
					></motion.img>
				</AnimatePresence>
			</span>
		</button>
	);
}
