import assert from "node:assert/strict";
import test from "node:test";
import { isLocalFontAvailable } from "../src/dev/localFontPreview.mjs";

// Inter resolves as a CSS family even when local("Inter") cannot identify a face.
const fakeDocument = (available) => ({
	createElement: () => ({
		getContext: () => ({
			font: "",
			measureText() {
				const fallbackWidth = this.font.endsWith("monospace") ? 600 : 550;
				return { width: available && this.font.includes('"Inter"') ? 679 : fallbackWidth };
			},
		}),
	}),
});

test("accepts an installed family without requiring a matching full face name", async () => {
	assert.equal(await isLocalFontAvailable("Inter", fakeDocument(true)), true);
});

test("rejects a missing family that silently renders each fallback", async () => {
	assert.equal(await isLocalFontAvailable("Missing font", fakeDocument(false)), false);
});
