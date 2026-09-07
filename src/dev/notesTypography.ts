import type { DialConfig, ResolvedValues } from "dialkit";

const range = (
	value: number,
	min: number,
	max: number,
	step = 1,
): [number, number, number, number] => [value, min, max, step];
const text = (size: number, weight: number, leading: number, tracking = 0) => ({
	fontSizePx: range(size, 10, 96, 0.5),
	fontWeight: range(weight, 100, 900, 10),
	lineHeight: range(leading, 0.9, 2.5, 0.01),
	letterSpacingEm: range(tracking, -0.1, 0.2, 0.001),
});
const heading = (size: number, leading: number, before: number, after: number) => ({
	_collapsed: true,
	...text(size, 700, leading),
	spaceBeforePx: range(before, 0, 160),
	spaceAfterPx: range(after, 0, 96),
});
const breakpoint = (desktop: boolean) => ({
	_collapsed: true,
	body: {
		...text(desktop ? 18 : 16, 500, desktop ? 28 / 18 : 1.5),
		paragraphSpacePx: range(desktop ? 24 : 20, 0, 96),
	},
	pageTitle: {
		...heading(desktop ? 60 : 36, 1.1, 0, 64),
		letterSpacingEm: range(-0.02, -0.1, 0.2, 0.001),
	},
	h1: heading(desktop ? 48 : 36, 1, 0, desktop ? 40 : 32),
	h2: heading(desktop ? 36 : 30, 1.11, desktop ? 56 : 48, desktop ? 28 : 24),
	h3: heading(desktop ? 30 : 24, 1.33, desktop ? 40 : 32, desktop ? 16 : 12),
	h4: heading(desktop ? 18 : 16, 1.5, desktop ? 32 : 24, 8),
	h5: heading(desktop ? 18 : 16, 1.5, 24, 8),
	h6: heading(desktop ? 18 : 16, 1.5, 24, 8),
	lists: {
		_collapsed: true,
		...text(desktop ? 18 : 16, 500, desktop ? 28 / 18 : 1.5),
		blockSpacePx: range(desktop ? 24 : 20, 0, 96),
		itemSpacePx: range(desktop ? 12 : 8, 0, 48),
		indentPx: range(desktop ? 28 : 26, 0, 80),
		nestedSpacePx: range(desktop ? 16 : 12, 0, 64),
		paragraphSpacePx: range(desktop ? 16 : 12, 0, 64),
	},
	blockquote: {
		_collapsed: true,
		...text(desktop ? 18 : 16, 500, 1.6),
		spacePx: range(desktop ? 32 : 24, 0, 96),
		indentPx: range(desktop ? 24 : 20, 0, 80),
		italic: true,
	},
	inline: {
		_collapsed: true,
		strongWeight: range(600, 100, 900, 10),
		linkWeight: range(500, 100, 900, 10),
		underlineOffsetPx: range(3, 0, 12, 0.5),
		underlineThicknessPx: range(2, 0.5, 6, 0.5),
		codeSizePx: range(desktop ? 16 : 14, 10, 32, 0.5),
		codeWeight: range(500, 100, 900, 10),
	},
});

export const notesTypographyConfig = {
	mobile: breakpoint(false),
	desktop: breakpoint(true),
	copyCss: { type: "action", label: "Copy CSS" },
	downloadCss: { type: "action", label: "Download CSS" },
	reset: { type: "action", label: "Reset to starting values" },
} satisfies DialConfig;

type Typography = ResolvedValues<typeof notesTypographyConfig>;
type TextSettings = Typography["mobile"]["body"];
const scope = ".notes-prose";
// Match Tailwind Typography's opt-out, including custom Markdoc widgets.
const selector = (tags: string) => `${scope} :where(${tags}):not(:where(.not-prose, .not-prose *))`;
const rule = (target: string, declarations: string) => `${target} {\n  ${declarations}\n}\n`;
const font = (
	value: Pick<TextSettings, "fontSizePx" | "fontWeight" | "lineHeight" | "letterSpacingEm">,
) =>
	`font-size: calc(${value.fontSizePx} / 16 * 1rem); font-weight: ${value.fontWeight}; line-height: ${value.lineHeight}; letter-spacing: ${value.letterSpacingEm}em;`;

function breakpointCss(value: Typography["mobile"]) {
	let css = rule(scope, font(value.body));
	css += rule(selector("p"), `margin-block: ${value.body.paragraphSpacePx}px;`);
	css += rule(
		"[data-notes-title]",
		`${font(value.pageTitle)} margin-block: ${value.pageTitle.spaceBeforePx}px ${value.pageTitle.spaceAfterPx}px;`,
	);
	for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
		const h = value[tag];
		css += rule(
			selector(tag),
			`${font(h)} margin-block: ${h.spaceBeforePx}px ${h.spaceAfterPx}px;`,
		);
	}
	const list = value.lists;
	css += rule(
		selector("ul, ol"),
		`${font(list)} margin-block: ${list.blockSpacePx}px; padding-inline-start: ${list.indentPx}px;`,
	);
	css += rule(selector("li"), `margin-block: ${list.itemSpacePx}px;`);
	css += rule(selector("li > ul, li > ol"), `margin-block: ${list.nestedSpacePx}px;`);
	css += rule(selector("li > p"), `margin-block: ${list.paragraphSpacePx}px;`);
	const quote = value.blockquote;
	css += rule(
		selector("blockquote"),
		`${font(quote)} margin-block: ${quote.spacePx}px; padding-inline-start: ${quote.indentPx}px; font-style: ${quote.italic ? "italic" : "normal"};`,
	);
	const inline = value.inline;
	css += rule(selector("strong"), `font-weight: ${inline.strongWeight};`);
	css += rule(
		selector("a"),
		`font-weight: ${inline.linkWeight}; text-underline-offset: ${inline.underlineOffsetPx}px; text-decoration-thickness: ${inline.underlineThicknessPx}px;`,
	);
	css += rule(
		selector("code:not(pre code)"),
		`font-size: calc(${inline.codeSizePx} / 16 * 1rem); font-weight: ${inline.codeWeight};`,
	);
	return css;
}

export function notesTypographyCss(value: Typography) {
	return `/* Notes typography experiment. Unlayered rules override prose utilities.\n * Mobile: below 48rem. Desktop: 48rem and up.\n * Requires .notes-prose on the prose container and data-notes-title on the title.\n */\n${breakpointCss(value.mobile)}\n@media (min-width: 48rem) {\n${breakpointCss(value.desktop)}}\n`;
}
