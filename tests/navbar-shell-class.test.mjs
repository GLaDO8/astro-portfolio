import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cn } from "../src/lib/cn.ts";

const navbarComponent = readFileSync("src/components/Navbar.astro", "utf8");
const sidequestsPage = readFileSync("src/pages/sidequests.astro", "utf8");

const defaultShellClass = "sticky top-4 z-40 mx-auto mb-12 w-full max-w-[39.25rem]";
const sidequestsNavClass = sidequestsPage.match(/navClass="([^"]+)"/)?.[1];

test("Navbar merges shell classes so page-level layout overrides win", () => {
	assert.match(navbarComponent, /const shellClass = cn\(/);
});

test("sidequests navbar shell does not keep the default full-width sticky wrapper", () => {
	assert.ok(sidequestsNavClass);

	const mergedClass = cn(defaultShellClass, sidequestsNavClass);

	assert.match(mergedClass, /\bfixed\b/);
	assert.doesNotMatch(mergedClass, /\bsticky\b/);
	assert.match(mergedClass, /w-\[min\(calc\(100%_-_2rem\),39\.25rem\)\]/);
	assert.doesNotMatch(mergedClass, /\bw-full\b/);
	assert.match(mergedClass, /max-w-\[calc\(100%_-_2rem\)\]/);
	assert.doesNotMatch(mergedClass, /max-w-\[39\.25rem\]/);
	assert.match(mergedClass, /\bmb-0\b/);
	assert.doesNotMatch(mergedClass, /\bmb-12\b/);
});
