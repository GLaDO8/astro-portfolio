import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
	clearHeroGoogleFontFamily,
	clearHeroGoogleFontSize,
	clearHeroGoogleFontWeight,
	clearHeroGoogleLetterSpacing,
	clearHeroGoogleLineHeight,
	getHeroGoogleFontSizeValue,
	getHeroGoogleFontWeightValue,
	getHeroGoogleLetterSpacingValue,
	getHeroGoogleLineHeightValue,
	installHeroGoogleFontStylesheet,
	parseGoogleFontsEmbed,
	removeHeroGoogleFontStylesheet,
	setHeroGoogleFontFamily,
	setHeroGoogleFontSize,
	setHeroGoogleFontWeight,
	setHeroGoogleLetterSpacing,
	setHeroGoogleLineHeight,
} from "@/dev/heroGoogleFontSwap";

const STORAGE_PREFIX = "site:hero-google-font-swap:v2";
const EMBED_STORAGE_KEY = `${STORAGE_PREFIX}:embed`;
const FONT_SIZE_STORAGE_KEY = `${STORAGE_PREFIX}:size`;
const FONT_WEIGHT_STORAGE_KEY = `${STORAGE_PREFIX}:weight`;
const LETTER_SPACING_STORAGE_KEY = `${STORAGE_PREFIX}:letter-spacing`;
const LINE_HEIGHT_STORAGE_KEY = `${STORAGE_PREFIX}:line-height`;

type HeroGoogleFontSwapState = {
	embedCode: string;
	fontFamily: string | null;
	trialFontSize: string;
	trialFontWeight: string;
	trialLetterSpacing: string;
	trialLineHeight: string;
	status: string;
	error: string | null;
};

type HeroGoogleFontSwapWidgetProps = {
	enabled?: boolean;
};

type HeroGoogleFontSwapControlsProps = {
	embedCode: string;
	fontFamily: string | null;
	trialFontSize: string;
	trialFontWeight: string;
	trialLetterSpacing: string;
	trialLineHeight: string;
	status: string;
	error: string | null;
	onApply: (
		embedCode: string,
		trialFontSize: string,
		trialFontWeight: string,
		trialLetterSpacing: string,
		trialLineHeight: string,
	) => boolean;
	onClear: () => void;
};

const defaultState: HeroGoogleFontSwapState = {
	embedCode: "",
	fontFamily: null,
	trialFontSize: "",
	trialFontWeight: "",
	trialLetterSpacing: "",
	trialLineHeight: "",
	status: "No trial font",
	error: null,
};

function getTrialSummary(
	fontFamily: string | null,
	fontSizeValue: string,
	fontWeightValue: string,
	letterSpacingValue: string,
	lineHeightValue: string,
) {
	const parts = [
		fontFamily ?? "Hero font",
		fontSizeValue,
		fontWeightValue && `${fontWeightValue} weight`,
		letterSpacingValue && `${letterSpacingValue} LS`,
		lineHeightValue && `${lineHeightValue} LH`,
	].filter(Boolean);

	return parts.join(" · ");
}

function getTrialButtonLabel(
	fontFamily: string | null,
	trialFontSize: string,
	trialFontWeight: string,
	trialLetterSpacing: string,
	trialLineHeight: string,
) {
	if (
		!fontFamily &&
		!trialFontSize &&
		!trialFontWeight &&
		!trialLetterSpacing &&
		!trialLineHeight
	) {
		return "Hero font";
	}

	return [
		fontFamily ?? "Hero font",
		trialFontSize && `${trialFontSize}px`,
		trialFontWeight && `${trialFontWeight} weight`,
		trialLetterSpacing && `${trialLetterSpacing}px LS`,
		trialLineHeight && `${trialLineHeight} LH`,
	]
		.filter(Boolean)
		.join(" · ");
}

export function useHeroGoogleFontSwap(enabled: boolean) {
	const [state, setState] = useState<HeroGoogleFontSwapState>(defaultState);

	const applyEmbedCode = useCallback(
		(
			embedCode: string,
			trialFontSize: string,
			trialFontWeight: string,
			trialLetterSpacing: string,
			trialLineHeight: string,
		) => {
			if (!enabled || typeof window === "undefined") {
				return false;
			}

			const trimmedEmbedCode = embedCode.trim();
			const trimmedFontSize = trialFontSize.trim();
			const trimmedFontWeight = trialFontWeight.trim();
			const trimmedLetterSpacing = trialLetterSpacing.trim();
			const trimmedLineHeight = trialLineHeight.trim();
			const fontSizeValue = getHeroGoogleFontSizeValue(trimmedFontSize);
			const fontWeightValue = getHeroGoogleFontWeightValue(trimmedFontWeight);
			const letterSpacingValue = getHeroGoogleLetterSpacingValue(trimmedLetterSpacing);
			const lineHeightValue = getHeroGoogleLineHeightValue(trimmedLineHeight);

			if (
				!trimmedEmbedCode &&
				!trimmedFontSize &&
				!trimmedFontWeight &&
				!trimmedLetterSpacing &&
				!trimmedLineHeight
			) {
				return false;
			}

			if (trimmedFontSize && !fontSizeValue) {
				setState({
					embedCode,
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status: "Could not apply size",
					error: "Use a positive px font size.",
				});
				return false;
			}

			if (trimmedFontWeight && !fontWeightValue) {
				setState({
					embedCode,
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status: "Could not apply weight",
					error: "Use a whole-number font weight from 1 to 1000.",
				});
				return false;
			}

			if (trimmedLetterSpacing && !letterSpacingValue) {
				setState({
					embedCode,
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status: "Could not apply letter spacing",
					error: "Use a numeric px letter spacing.",
				});
				return false;
			}

			if (trimmedLineHeight && !lineHeightValue) {
				setState({
					embedCode,
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status: "Could not apply line height",
					error: "Use a positive unitless line height.",
				});
				return false;
			}

			if (trimmedFontSize) {
				window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, trimmedFontSize);
				setHeroGoogleFontSize(trimmedFontSize);
			} else {
				window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY);
				clearHeroGoogleFontSize();
			}

			if (trimmedFontWeight) {
				window.localStorage.setItem(FONT_WEIGHT_STORAGE_KEY, trimmedFontWeight);
				setHeroGoogleFontWeight(trimmedFontWeight);
			} else {
				window.localStorage.removeItem(FONT_WEIGHT_STORAGE_KEY);
				clearHeroGoogleFontWeight();
			}

			if (trimmedLetterSpacing) {
				window.localStorage.setItem(LETTER_SPACING_STORAGE_KEY, trimmedLetterSpacing);
				setHeroGoogleLetterSpacing(trimmedLetterSpacing);
			} else {
				window.localStorage.removeItem(LETTER_SPACING_STORAGE_KEY);
				clearHeroGoogleLetterSpacing();
			}

			if (trimmedLineHeight) {
				window.localStorage.setItem(LINE_HEIGHT_STORAGE_KEY, trimmedLineHeight);
				setHeroGoogleLineHeight(trimmedLineHeight);
			} else {
				window.localStorage.removeItem(LINE_HEIGHT_STORAGE_KEY);
				clearHeroGoogleLineHeight();
			}

			if (!trimmedEmbedCode) {
				setState({
					embedCode: "",
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status:
						fontSizeValue || fontWeightValue || letterSpacingValue || lineHeightValue
							? `Using ${getTrialSummary(
									null,
									fontSizeValue,
									fontWeightValue,
									letterSpacingValue,
									lineHeightValue,
								)}`
							: "No trial font",
					error: null,
				});
				return true;
			}

			const parsed = parseGoogleFontsEmbed(trimmedEmbedCode);

			if (!parsed.ok) {
				setState({
					embedCode,
					fontFamily: null,
					trialFontSize: trimmedFontSize,
					trialFontWeight: trimmedFontWeight,
					trialLetterSpacing: trimmedLetterSpacing,
					trialLineHeight: trimmedLineHeight,
					status: "Could not parse font",
					error: parsed.error,
				});
				return false;
			}

			window.localStorage.setItem(EMBED_STORAGE_KEY, trimmedEmbedCode);
			installHeroGoogleFontStylesheet(parsed.stylesheetUrl);
			setHeroGoogleFontFamily(parsed.fontFamily);
			setState({
				embedCode: trimmedEmbedCode,
				fontFamily: parsed.fontFamily,
				trialFontSize: trimmedFontSize,
				trialFontWeight: trimmedFontWeight,
				trialLetterSpacing: trimmedLetterSpacing,
				trialLineHeight: trimmedLineHeight,
				status: `Using ${getTrialSummary(
					parsed.fontFamily,
					fontSizeValue,
					fontWeightValue,
					letterSpacingValue,
					lineHeightValue,
				)}`,
				error: null,
			});

			return true;
		},
		[enabled],
	);

	const clear = useCallback(() => {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(EMBED_STORAGE_KEY);
			window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY);
			window.localStorage.removeItem(FONT_WEIGHT_STORAGE_KEY);
			window.localStorage.removeItem(LETTER_SPACING_STORAGE_KEY);
			window.localStorage.removeItem(LINE_HEIGHT_STORAGE_KEY);
			removeHeroGoogleFontStylesheet();
			clearHeroGoogleFontFamily();
			clearHeroGoogleFontSize();
			clearHeroGoogleFontWeight();
			clearHeroGoogleLetterSpacing();
			clearHeroGoogleLineHeight();
		}

		setState(defaultState);
	}, []);

	useEffect(() => {
		if (!enabled || typeof window === "undefined") {
			return;
		}

		const storedEmbedCode = window.localStorage.getItem(EMBED_STORAGE_KEY);
		const storedFontSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY) ?? "";
		const storedFontWeight = window.localStorage.getItem(FONT_WEIGHT_STORAGE_KEY) ?? "";
		const storedLetterSpacing = window.localStorage.getItem(LETTER_SPACING_STORAGE_KEY) ?? "";
		const storedLineHeight = window.localStorage.getItem(LINE_HEIGHT_STORAGE_KEY) ?? "";

		if (
			storedEmbedCode ||
			storedFontSize ||
			storedFontWeight ||
			storedLetterSpacing ||
			storedLineHeight
		) {
			applyEmbedCode(
				storedEmbedCode ?? "",
				storedFontSize,
				storedFontWeight,
				storedLetterSpacing,
				storedLineHeight,
			);
		}
	}, [applyEmbedCode, enabled]);

	return {
		...state,
		applyEmbedCode,
		clear,
	};
}

function HeroGoogleFontSwapControls({
	embedCode,
	fontFamily,
	trialFontSize,
	trialFontWeight,
	trialLetterSpacing,
	trialLineHeight,
	status,
	error,
	onApply,
	onClear,
}: HeroGoogleFontSwapControlsProps) {
	const inputId = useId();
	const fontSizeInputId = useId();
	const fontWeightInputId = useId();
	const letterSpacingInputId = useId();
	const lineHeightInputId = useId();
	const [draftEmbedCode, setDraftEmbedCode] = useState(embedCode);
	const [draftFontSize, setDraftFontSize] = useState(trialFontSize);
	const [draftFontWeight, setDraftFontWeight] = useState(trialFontWeight);
	const [draftLetterSpacing, setDraftLetterSpacing] = useState(trialLetterSpacing);
	const [draftLineHeight, setDraftLineHeight] = useState(trialLineHeight);
	const [isOpen, setIsOpen] = useState(false);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setDraftEmbedCode(embedCode);
	}, [embedCode]);

	useEffect(() => {
		setDraftFontSize(trialFontSize);
	}, [trialFontSize]);

	useEffect(() => {
		setDraftFontWeight(trialFontWeight);
	}, [trialFontWeight]);

	useEffect(() => {
		setDraftLetterSpacing(trialLetterSpacing);
	}, [trialLetterSpacing]);

	useEffect(() => {
		setDraftLineHeight(trialLineHeight);
	}, [trialLineHeight]);

	useEffect(() => {
		setPortalTarget(document.body);
	}, []);

	const applyDraft = () => {
		const didApply = onApply(
			draftEmbedCode,
			draftFontSize,
			draftFontWeight,
			draftLetterSpacing,
			draftLineHeight,
		);

		if (didApply) {
			setIsOpen(false);
		}
	};

	const widget = (
		<div
			data-hero-google-font-swap
			className="fixed bottom-4 left-4 z-[2147483647] w-[min(21rem,calc(100vw-2rem))] text-left font-sans text-sm text-primary"
		>
			{isOpen ? (
				<div className="rounded-lg border border-primary/10 bg-white/95 p-3 shadow-[0_14px_40px_rgba(42,35,29,0.14)] backdrop-blur">
					<div className="flex items-center justify-between gap-3">
						<label htmlFor={inputId} className="font-semibold">
							Hero font
						</label>
						<button
							type="button"
							className="rounded-md px-2 py-1 text-xs font-semibold text-secondary transition-colors hover:bg-tertiary/60 hover:text-primary"
							onClick={() => setIsOpen(false)}
						>
							Close
						</button>
					</div>

					<textarea
						id={inputId}
						data-hero-google-font-swap-input
						className="mt-3 min-h-28 w-full resize-y rounded-md border border-primary/15 bg-beige/50 p-2 font-mono text-xs leading-relaxed text-primary outline-none transition-colors placeholder:text-secondary/70 focus:border-primary/40"
						value={draftEmbedCode}
						placeholder="Paste Google Fonts embed code, @import, or https://fonts.googleapis.com/css2?..."
						onChange={(event) => setDraftEmbedCode(event.target.value)}
						onPaste={(event) => {
							const target = event.currentTarget;

							window.setTimeout(() => {
								onApply(
									target.value,
									draftFontSize,
									draftFontWeight,
									draftLetterSpacing,
									draftLineHeight,
								);
							}, 0);
						}}
					/>

					<div className="mt-3 flex flex-wrap gap-2">
						<div className="min-w-0 flex-1 basis-24">
							<label
								htmlFor={fontSizeInputId}
								className="flex items-center justify-between gap-3 text-xs font-semibold text-secondary"
							>
								<span>Font size</span>
								<span className="font-normal">px</span>
							</label>
							<input
								id={fontSizeInputId}
								data-hero-google-font-swap-size-input
								className="mt-1 w-full rounded-md border border-primary/15 bg-beige/50 px-2 py-1.5 font-mono text-xs text-primary outline-none transition-colors placeholder:text-secondary/70 focus:border-primary/40"
								type="number"
								min="1"
								step="1"
								inputMode="decimal"
								value={draftFontSize}
								placeholder="60"
								onChange={(event) => setDraftFontSize(event.target.value)}
							/>
						</div>

						<div className="min-w-0 flex-1 basis-24">
							<label
								htmlFor={fontWeightInputId}
								className="flex items-center justify-between gap-3 text-xs font-semibold text-secondary"
							>
								<span>Weight</span>
								<span className="font-normal">1-1000</span>
							</label>
							<input
								id={fontWeightInputId}
								data-hero-google-font-swap-weight-input
								className="mt-1 w-full rounded-md border border-primary/15 bg-beige/50 px-2 py-1.5 font-mono text-xs text-primary outline-none transition-colors placeholder:text-secondary/70 focus:border-primary/40"
								type="number"
								min="1"
								max="1000"
								step="1"
								inputMode="numeric"
								value={draftFontWeight}
								placeholder="700"
								onChange={(event) => setDraftFontWeight(event.target.value)}
							/>
						</div>

						<div className="min-w-0 flex-1 basis-24">
							<label
								htmlFor={letterSpacingInputId}
								className="flex items-center justify-between gap-3 text-xs font-semibold text-secondary"
							>
								<span>Letter spacing</span>
								<span className="font-normal">px</span>
							</label>
							<input
								id={letterSpacingInputId}
								data-hero-google-font-swap-letter-spacing-input
								className="mt-1 w-full rounded-md border border-primary/15 bg-beige/50 px-2 py-1.5 font-mono text-xs text-primary outline-none transition-colors placeholder:text-secondary/70 focus:border-primary/40"
								type="number"
								step="0.1"
								inputMode="decimal"
								value={draftLetterSpacing}
								placeholder="-1"
								onChange={(event) => setDraftLetterSpacing(event.target.value)}
							/>
						</div>

						<div className="min-w-0 flex-1 basis-24">
							<label
								htmlFor={lineHeightInputId}
								className="flex items-center justify-between gap-3 text-xs font-semibold text-secondary"
							>
								<span>Line height</span>
								<span className="font-normal">ratio</span>
							</label>
							<input
								id={lineHeightInputId}
								data-hero-google-font-swap-line-height-input
								className="mt-1 w-full rounded-md border border-primary/15 bg-beige/50 px-2 py-1.5 font-mono text-xs text-primary outline-none transition-colors placeholder:text-secondary/70 focus:border-primary/40"
								type="number"
								min="0.1"
								step="0.05"
								inputMode="decimal"
								value={draftLineHeight}
								placeholder="1"
								onChange={(event) => setDraftLineHeight(event.target.value)}
							/>
						</div>
					</div>

					<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
						<p className={error ? "text-xs font-medium text-red-700" : "text-xs text-secondary"}>
							{error ?? status}
						</p>
						<div className="flex items-center gap-2">
							<button
								type="button"
								className="rounded-md px-2.5 py-1 text-xs font-semibold text-secondary transition-colors hover:bg-tertiary/60 hover:text-primary"
								onClick={onClear}
							>
								Reset
							</button>
							<button
								type="button"
								data-hero-google-font-swap-apply
								className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
								onClick={applyDraft}
							>
								Apply
							</button>
						</div>
					</div>
				</div>
			) : (
				<button
					type="button"
					data-hero-google-font-swap-trigger
					className="rounded-full border border-primary/10 bg-white/95 px-3 py-2 font-semibold text-primary shadow-[0_10px_30px_rgba(42,35,29,0.12)] backdrop-blur transition-transform hover:-translate-y-0.5"
					onClick={() => setIsOpen(true)}
				>
					{getTrialButtonLabel(
						fontFamily,
						trialFontSize,
						trialFontWeight,
						trialLetterSpacing,
						trialLineHeight,
					)}
				</button>
			)}
		</div>
	);

	return portalTarget ? createPortal(widget, portalTarget) : null;
}

export default function HeroGoogleFontSwapWidget({
	enabled = true,
}: HeroGoogleFontSwapWidgetProps) {
	const heroFontSwap = useHeroGoogleFontSwap(enabled);

	if (!enabled) {
		return null;
	}

	return (
		<HeroGoogleFontSwapControls
			embedCode={heroFontSwap.embedCode}
			fontFamily={heroFontSwap.fontFamily}
			trialFontSize={heroFontSwap.trialFontSize}
			trialFontWeight={heroFontSwap.trialFontWeight}
			trialLetterSpacing={heroFontSwap.trialLetterSpacing}
			trialLineHeight={heroFontSwap.trialLineHeight}
			status={heroFontSwap.status}
			error={heroFontSwap.error}
			onApply={heroFontSwap.applyEmbedCode}
			onClear={heroFontSwap.clear}
		/>
	);
}
