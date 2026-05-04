import assert from "node:assert/strict";
import test from "node:test";
import { createDevOverlayStylePreserver } from "../src/dev/devOverlayStyles.js";

class FakeStyleElement {
	constructor(id = "", textContent = "") {
		this.dataset = {};
		this.id = id;
		this.textContent = textContent;
	}
}

class FakeHead {
	constructor() {
		this.children = [];
	}

	appendChild(node) {
		this.children.push(node);
		return node;
	}

	querySelectorAll(selector) {
		if (selector !== "style[id]") {
			return [];
		}

		return this.children.filter((node) => node.id);
	}
}

class FakeDocument {
	constructor(styles = []) {
		this.head = new FakeHead();

		for (const [id, textContent] of styles) {
			this.head.appendChild(new FakeStyleElement(id, textContent));
		}
	}

	createElement(tagName) {
		assert.equal(tagName, "style");
		return new FakeStyleElement();
	}

	getElementById(id) {
		return this.head.children.find((node) => node.id === id) ?? null;
	}
}

test("copies dev overlay runtime styles into Astro's incoming document", () => {
	const preserver = createDevOverlayStylePreserver();
	const currentDocument = new FakeDocument([
		["feedback-tool-styles-page-toolbar-css-styles", ".agentation{display:block}"],
		["mesurer-styles", ".fixed{position:fixed}"],
		["site-style", ".site{}"],
	]);
	const incomingDocument = new FakeDocument();

	const restoredCount = preserver.copy({
		sourceDocument: currentDocument,
		targetDocument: incomingDocument,
	});

	assert.equal(restoredCount, 2);
	assert.equal(
		incomingDocument.getElementById("feedback-tool-styles-page-toolbar-css-styles").textContent,
		".agentation{display:block}",
	);
	assert.equal(
		incomingDocument.getElementById("mesurer-styles").textContent,
		".fixed{position:fixed}",
	);
	assert.equal(incomingDocument.getElementById("site-style"), null);
});

test("restores cached overlay styles after a swap without duplicating existing tags", () => {
	const preserver = createDevOverlayStylePreserver();
	const currentDocument = new FakeDocument([
		["agentation-color-tokens", ":root{--agentation-color-blue:#0d99ff}"],
		["feedback-tool-styles-help-tooltip-styles", ".tooltip{opacity:1}"],
	]);
	const swappedDocument = new FakeDocument([
		["agentation-color-tokens", ":root{--agentation-color-blue:#0d99ff}"],
	]);

	preserver.snapshot(currentDocument);
	const restoredCount = preserver.restore(swappedDocument);

	assert.equal(restoredCount, 1);
	assert.equal(
		swappedDocument.head.children.filter((node) => node.id === "agentation-color-tokens").length,
		1,
	);
	assert.equal(
		swappedDocument.getElementById("feedback-tool-styles-help-tooltip-styles").textContent,
		".tooltip{opacity:1}",
	);
});
