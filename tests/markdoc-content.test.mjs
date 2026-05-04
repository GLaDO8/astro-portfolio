import assert from "node:assert/strict";
import test from "node:test";
import { hasCodeFence } from "../src/lib/markdocContent.ts";

test("hasCodeFence detects Markdown fenced code blocks", () => {
	assert.equal(hasCodeFence("Before\n```js\nconsole.log('hi');\n```"), true);
	assert.equal(hasCodeFence("Before\n~~~ts\nconst value = true;\n~~~"), true);
	assert.equal(hasCodeFence("Before\n   ```js\nconsole.log('hi');\n```"), true);
});

test("hasCodeFence ignores inline code and empty content", () => {
	assert.equal(hasCodeFence("Use `code` inline."), false);
	assert.equal(hasCodeFence(undefined), false);
});
