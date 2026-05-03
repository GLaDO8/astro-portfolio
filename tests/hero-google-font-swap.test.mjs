import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let server;
let parseGoogleFontsEmbed;
let getHeroGoogleFontFamilyValue;
let getHeroGoogleFontSizeValue;
let getHeroGoogleLetterSpacingValue;
let getHeroGoogleLineHeightValue;

before(async () => {
	server = await createServer({
		appType: "custom",
		logLevel: "silent",
		root,
		server: {
			middlewareMode: true,
		},
		resolve: {
			alias: {
				"@": resolve(root, "src"),
			},
		},
	});

	({
		parseGoogleFontsEmbed,
		getHeroGoogleFontFamilyValue,
		getHeroGoogleFontSizeValue,
		getHeroGoogleLetterSpacingValue,
		getHeroGoogleLineHeightValue,
	} = await server.ssrLoadModule("/src/lib/heroGoogleFontSwap.ts"));
});

after(async () => {
	await server?.close();
});

test("parses the stylesheet link from a full Google Fonts embed snippet", () => {
	const parsed = parseGoogleFontsEmbed(`
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,700;1,400;1,700&amp;display=swap" rel="stylesheet">
	`);

	assert.equal(parsed.ok, true);
	assert.equal(parsed.fontFamily, "DM Sans");
	assert.match(parsed.stylesheetUrl, /family=DM\+Sans/);
	assert.match(parsed.stylesheetUrl, /display=swap/);
});

test("parses CSS import snippets and direct CSS2 URLs", () => {
	assert.deepEqual(
		parseGoogleFontsEmbed(
			"@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&display=swap');",
		),
		{
			ok: true,
			stylesheetUrl:
				"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&display=swap",
			fontFamily: "Bricolage Grotesque",
		},
	);

	assert.equal(
		parseGoogleFontsEmbed(
			"https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
		).fontFamily,
		"Instrument Serif",
	);
});

test("rejects non-stylesheet Google URLs", () => {
	assert.deepEqual(parseGoogleFontsEmbed("https://fonts.gstatic.com/s/example.woff2"), {
		ok: false,
		error: "Paste a Google Fonts CSS2 stylesheet link or embed code.",
	});
});

test("builds a quoted font-family value with the existing local font fallback", () => {
	assert.equal(
		getHeroGoogleFontFamilyValue('Shreyas "Test"'),
		'"Shreyas \\"Test\\"", var(--font-commissioner), sans-serif',
	);
});

test("normalizes positive font-size values to pixels", () => {
	assert.equal(getHeroGoogleFontSizeValue("48"), "48px");
	assert.equal(getHeroGoogleFontSizeValue("48.5"), "48.5px");
	assert.equal(getHeroGoogleFontSizeValue(""), "");
	assert.equal(getHeroGoogleFontSizeValue("0"), "");
	assert.equal(getHeroGoogleFontSizeValue("-1"), "");
	assert.equal(getHeroGoogleFontSizeValue("large"), "");
});

test("normalizes numeric letter-spacing values to pixels", () => {
	assert.equal(getHeroGoogleLetterSpacingValue("-1"), "-1px");
	assert.equal(getHeroGoogleLetterSpacingValue("0"), "0px");
	assert.equal(getHeroGoogleLetterSpacingValue("1.25"), "1.25px");
	assert.equal(getHeroGoogleLetterSpacingValue(""), "");
	assert.equal(getHeroGoogleLetterSpacingValue("tight"), "");
});

test("normalizes positive line-height values as unitless CSS numbers", () => {
	assert.equal(getHeroGoogleLineHeightValue("0.95"), "0.95");
	assert.equal(getHeroGoogleLineHeightValue("1"), "1");
	assert.equal(getHeroGoogleLineHeightValue("1.1"), "1.1");
	assert.equal(getHeroGoogleLineHeightValue(""), "");
	assert.equal(getHeroGoogleLineHeightValue("0"), "");
	assert.equal(getHeroGoogleLineHeightValue("-1"), "");
	assert.equal(getHeroGoogleLineHeightValue("normal"), "");
});
