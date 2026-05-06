import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/sidequests/CADRender.tsx", "utf8");
const canvasSource = readFileSync("src/components/sidequests/SidequestsCanvas.tsx", "utf8");

test("CAD model viewer hides native scrollbars", () => {
	assert.match(source, /overflow-hidden/);
	assert.match(source, /\[scrollbar-width:none\]/);
	assert.match(source, /\[-ms-overflow-style:none\]/);
	assert.match(source, /\[&::-webkit-scrollbar\]:hidden/);
});

test("CAD model viewer hides scrollbars inside model-viewer shadow DOM", () => {
	assert.match(source, /shadowScrollbarReset/);
	assert.match(source, /hideCADModelViewerScrollbars/);
	assert.match(source, /shadowRoot\.append\(style\)/);
	assert.match(source, /\*::-webkit-scrollbar/);
	assert.match(canvasSource, /hideCADModelViewerScrollbars\(viewer\)/);
});

test("CAD model viewer keeps rotation controls but disables zoom", () => {
	assert.match(source, /"camera-controls":\s*""/);
	assert.match(source, /"disable-zoom":\s*""/);
});

test("CAD model viewer applies the shared material override", () => {
	assert.match(canvasSource, /const cadMaterialColor/);
	assert.match(canvasSource, /setBaseColorFactor\(cadMaterialColor\)/);
	assert.match(canvasSource, /setMetallicFactor\(0\.7\)/);
	assert.match(canvasSource, /setRoughnessFactor\(0\.7\)/);
});
