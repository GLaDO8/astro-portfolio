const GOOGLE_FONT_STYLESHEET_HOST = "fonts.googleapis.com";
const GOOGLE_FONT_STYLESHEET_PATHS = new Set(["/css", "/css2"]);
const HERO_GOOGLE_FONT_LINK_ID = "hero-google-font-swap-stylesheet";
const GOOGLE_FONT_PRECONNECT_ID = "hero-google-font-swap-googleapis-preconnect";
const GOOGLE_FONT_STATIC_PRECONNECT_ID = "hero-google-font-swap-gstatic-preconnect";
const HERO_GOOGLE_FONT_FAMILY_PROPERTY = "--hero-google-font-swap-family";
const HERO_GOOGLE_FONT_SIZE_PROPERTY = "--hero-google-font-swap-size";
const HERO_GOOGLE_LETTER_SPACING_PROPERTY = "--hero-google-font-swap-letter-spacing";
const HERO_GOOGLE_LINE_HEIGHT_PROPERTY = "--hero-google-font-swap-line-height";
const HERO_GOOGLE_METRIC_OVERRIDES_STYLE_ID = "hero-google-font-swap-metric-overrides";

export type GoogleFontEmbedParseResult =
	| {
			ok: true;
			stylesheetUrl: string;
			fontFamily: string;
	  }
	| {
			ok: false;
			error: string;
	  };

function decodeHtmlEntities(value: string) {
	return value.replace(/&amp;/g, "&").trim();
}

function extractCandidateUrls(embedCode: string) {
	const urls = new Set<string>();
	const patterns = [
		/\bhref\s*=\s*["']([^"']+)["']/gi,
		/@import\s+(?:url\(\s*)?["']?(https:\/\/fonts\.googleapis\.com\/[^"')\s]+)["']?\s*\)?/gi,
		/https:\/\/fonts\.googleapis\.com\/[^\s"'<>)]*/gi,
	];

	for (const pattern of patterns) {
		for (const match of embedCode.matchAll(pattern)) {
			const candidate = match[1] ?? match[0];

			if (candidate) {
				urls.add(decodeHtmlEntities(candidate));
			}
		}
	}

	return [...urls];
}

export function parseGoogleFontsEmbed(embedCode: string): GoogleFontEmbedParseResult {
	const candidates = extractCandidateUrls(embedCode);

	for (const candidate of candidates) {
		let url: URL;

		try {
			url = new URL(candidate);
		} catch {
			continue;
		}

		if (
			url.protocol !== "https:" ||
			url.hostname !== GOOGLE_FONT_STYLESHEET_HOST ||
			!GOOGLE_FONT_STYLESHEET_PATHS.has(url.pathname)
		) {
			continue;
		}

		const fontFamilies = url.searchParams.getAll("family");
		const firstFamily = fontFamilies[0]?.split(":")[0]?.trim();

		if (firstFamily) {
			return {
				ok: true,
				stylesheetUrl: url.toString(),
				fontFamily: firstFamily,
			};
		}
	}

	return {
		ok: false,
		error: "Paste a Google Fonts CSS2 stylesheet link or embed code.",
	};
}

export function getHeroGoogleFontFamilyValue(fontFamily: string) {
	const escapedFontFamily = fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

	return `"${escapedFontFamily}", var(--font-commissioner), sans-serif`;
}

export function setHeroGoogleFontFamily(fontFamily: string, doc = document) {
	doc.documentElement.style.setProperty(
		HERO_GOOGLE_FONT_FAMILY_PROPERTY,
		getHeroGoogleFontFamilyValue(fontFamily),
	);
	syncHeroGoogleMetricOverrides(doc);
}

export function clearHeroGoogleFontFamily(doc = document) {
	doc.documentElement.style.removeProperty(HERO_GOOGLE_FONT_FAMILY_PROPERTY);
	syncHeroGoogleMetricOverrides(doc);
}

export function getHeroGoogleFontSizeValue(fontSize: string) {
	const trimmedFontSize = fontSize.trim();

	if (!trimmedFontSize) {
		return "";
	}

	const numericFontSize = Number(trimmedFontSize);

	if (!Number.isFinite(numericFontSize) || numericFontSize <= 0) {
		return "";
	}

	return `${numericFontSize}px`;
}

export function setHeroGoogleFontSize(fontSize: string, doc = document) {
	const fontSizeValue = getHeroGoogleFontSizeValue(fontSize);

	if (!fontSizeValue) {
		clearHeroGoogleFontSize(doc);
		return;
	}

	doc.documentElement.style.setProperty(HERO_GOOGLE_FONT_SIZE_PROPERTY, fontSizeValue);
	syncHeroGoogleMetricOverrides(doc);
}

export function clearHeroGoogleFontSize(doc = document) {
	doc.documentElement.style.removeProperty(HERO_GOOGLE_FONT_SIZE_PROPERTY);
	syncHeroGoogleMetricOverrides(doc);
}

export function getHeroGoogleLetterSpacingValue(letterSpacing: string) {
	const trimmedLetterSpacing = letterSpacing.trim();

	if (!trimmedLetterSpacing) {
		return "";
	}

	const numericLetterSpacing = Number(trimmedLetterSpacing);

	if (!Number.isFinite(numericLetterSpacing)) {
		return "";
	}

	return `${numericLetterSpacing}px`;
}

export function setHeroGoogleLetterSpacing(letterSpacing: string, doc = document) {
	const letterSpacingValue = getHeroGoogleLetterSpacingValue(letterSpacing);

	if (!letterSpacingValue) {
		clearHeroGoogleLetterSpacing(doc);
		return;
	}

	doc.documentElement.style.setProperty(HERO_GOOGLE_LETTER_SPACING_PROPERTY, letterSpacingValue);
	syncHeroGoogleMetricOverrides(doc);
}

export function clearHeroGoogleLetterSpacing(doc = document) {
	doc.documentElement.style.removeProperty(HERO_GOOGLE_LETTER_SPACING_PROPERTY);
	syncHeroGoogleMetricOverrides(doc);
}

export function getHeroGoogleLineHeightValue(lineHeight: string) {
	const trimmedLineHeight = lineHeight.trim();

	if (!trimmedLineHeight) {
		return "";
	}

	const numericLineHeight = Number(trimmedLineHeight);

	if (!Number.isFinite(numericLineHeight) || numericLineHeight <= 0) {
		return "";
	}

	return `${numericLineHeight}`;
}

export function setHeroGoogleLineHeight(lineHeight: string, doc = document) {
	const lineHeightValue = getHeroGoogleLineHeightValue(lineHeight);

	if (!lineHeightValue) {
		clearHeroGoogleLineHeight(doc);
		return;
	}

	doc.documentElement.style.setProperty(HERO_GOOGLE_LINE_HEIGHT_PROPERTY, lineHeightValue);
	syncHeroGoogleMetricOverrides(doc);
}

export function clearHeroGoogleLineHeight(doc = document) {
	doc.documentElement.style.removeProperty(HERO_GOOGLE_LINE_HEIGHT_PROPERTY);
	syncHeroGoogleMetricOverrides(doc);
}

function syncHeroGoogleMetricOverrides(doc: Document) {
	const fontFamily = doc.documentElement.style
		.getPropertyValue(HERO_GOOGLE_FONT_FAMILY_PROPERTY)
		.trim();
	const fontSize = doc.documentElement.style
		.getPropertyValue(HERO_GOOGLE_FONT_SIZE_PROPERTY)
		.trim();
	const letterSpacing = doc.documentElement.style
		.getPropertyValue(HERO_GOOGLE_LETTER_SPACING_PROPERTY)
		.trim();
	const lineHeight = doc.documentElement.style
		.getPropertyValue(HERO_GOOGLE_LINE_HEIGHT_PROPERTY)
		.trim();
	const declarations = [
		fontFamily ? `font-family: var(${HERO_GOOGLE_FONT_FAMILY_PROPERTY});` : "",
		fontSize ? `font-size: var(${HERO_GOOGLE_FONT_SIZE_PROPERTY});` : "",
		letterSpacing ? `letter-spacing: var(${HERO_GOOGLE_LETTER_SPACING_PROPERTY});` : "",
		lineHeight ? `line-height: var(${HERO_GOOGLE_LINE_HEIGHT_PROPERTY});` : "",
	]
		.filter(Boolean)
		.join("");
	const existingStyle = doc.getElementById(HERO_GOOGLE_METRIC_OVERRIDES_STYLE_ID);

	if (!declarations) {
		existingStyle?.remove();
		return;
	}

	const style =
		existingStyle instanceof HTMLStyleElement ? existingStyle : doc.createElement("style");
	style.id = HERO_GOOGLE_METRIC_OVERRIDES_STYLE_ID;
	style.textContent = `[data-hero-rotating-text]{${declarations}}`;

	if (!existingStyle) {
		doc.head.append(style);
	}
}

function ensurePreconnect(
	doc: Document,
	id: string,
	href: string,
	crossOrigin?: HTMLLinkElement["crossOrigin"],
) {
	if (doc.getElementById(id)) {
		return;
	}

	const link = doc.createElement("link");
	link.id = id;
	link.rel = "preconnect";
	link.href = href;

	if (crossOrigin !== undefined) {
		link.crossOrigin = crossOrigin;
	}

	doc.head.append(link);
}

export function installHeroGoogleFontStylesheet(stylesheetUrl: string, doc = document) {
	ensurePreconnect(doc, GOOGLE_FONT_PRECONNECT_ID, "https://fonts.googleapis.com");
	ensurePreconnect(doc, GOOGLE_FONT_STATIC_PRECONNECT_ID, "https://fonts.gstatic.com", "");

	const existingLink = doc.getElementById(HERO_GOOGLE_FONT_LINK_ID);

	if (existingLink instanceof HTMLLinkElement && existingLink.href === stylesheetUrl) {
		return;
	}

	existingLink?.remove();

	const link = doc.createElement("link");
	link.id = HERO_GOOGLE_FONT_LINK_ID;
	link.rel = "stylesheet";
	link.href = stylesheetUrl;
	doc.head.append(link);
}

export function removeHeroGoogleFontStylesheet(doc = document) {
	doc.getElementById(HERO_GOOGLE_FONT_LINK_ID)?.remove();
}
