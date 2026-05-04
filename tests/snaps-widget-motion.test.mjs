import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/widgets/SnapsWidget.tsx", "utf8");

test("SnapsWidget keeps polaroid transforms under Motion control", () => {
	assert.match(source, /variants=\{widgetVariants\}/);
	assert.match(source, /rest:\s*\{\s*x:\s*10,\s*y:\s*35,\s*rotate:\s*19\s*\}/s);
	assert.match(source, /hover:\s*\{\s*x:\s*30,\s*y:\s*0,\s*rotate:\s*25\s*\}/s);
	assert.match(source, /rest:\s*\{\s*x:\s*-60,\s*y:\s*45,\s*rotate:\s*-5\s*\}/s);
	assert.match(source, /hover:\s*\{\s*x:\s*-70,\s*y:\s*10,\s*rotate:\s*-11\s*\}/s);
	assert.match(source, /rest:\s*\{\s*x:\s*10,\s*y:\s*110,\s*rotate:\s*26\s*\}/s);
	assert.match(source, /hover:\s*\{\s*x:\s*30,\s*y:\s*80,\s*rotate:\s*32\s*\}/s);
	assert.match(source, /rest:\s*\{\s*\.\.\.polaroid\.rest,\s*scale:\s*0\.9\s*\}/s);
	assert.match(source, /hover:\s*\{\s*\.\.\.polaroid\.hover,\s*scale:\s*1\s*\}/s);
	assert.doesNotMatch(source, /positionClass|rotate-\[|scale-95/);
});
