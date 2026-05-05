import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/sidequests/CADRender.tsx", "utf8");

test("CAD model viewer hides native scrollbars", () => {
	assert.match(source, /overflow-hidden/);
	assert.match(source, /\[scrollbar-width:none\]/);
	assert.match(source, /\[-ms-overflow-style:none\]/);
	assert.match(source, /\[&::-webkit-scrollbar\]:hidden/);
});

test("CAD model viewer keeps rotation controls but disables zoom", () => {
	assert.match(source, /"camera-controls":\s*""/);
	assert.match(source, /"disable-zoom":\s*""/);
});
