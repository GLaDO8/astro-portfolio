import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Markdoc from "@markdoc/markdoc";
import markdocConfig from "../markdoc.config.ts";

const lottieComponentPath = "./src/components/mdoc/Lottie.astro";
const lottieComponent = readFileSync("src/components/mdoc/Lottie.astro", "utf8");

test("lottie tags render through the MDOC Lottie component", () => {
	const tree = Markdoc.transform(
		Markdoc.parse('{% lottie src="/lottie/labelling.json" label="Image-first flow" /%}'),
		markdocConfig,
	);
	const [lottie] = tree.children;

	assert.equal(lottie.name.path, lottieComponentPath);
	assert.deepEqual(lottie.attributes, {
		src: "/lottie/labelling.json",
		label: "Image-first flow",
		width: "wide",
		align: "center",
		aspectRatio: "video",
		loop: true,
		autoplay: true,
		controls: true,
	});
});

test("lottie tags can hide controls while looping automatically", () => {
	const tree = Markdoc.transform(
		Markdoc.parse(
			'{% lottie src="/lottie/labelling.json" label="Image-first flow" loop=true autoplay=true controls=false /%}',
		),
		markdocConfig,
	);
	const [lottie] = tree.children;

	assert.equal(lottie.name.path, lottieComponentPath);
	assert.deepEqual(lottie.attributes, {
		src: "/lottie/labelling.json",
		label: "Image-first flow",
		width: "wide",
		align: "center",
		aspectRatio: "video",
		loop: true,
		autoplay: true,
		controls: false,
	});
});

test("Lottie component loads JSON by path and cleans up animation instances", () => {
	assert.match(lottieComponent, /import lottie from "lottie-web"/);
	assert.match(lottieComponent, /lottie\.loadAnimation\(\{/);
	assert.match(lottieComponent, /path: src/);
	assert.match(lottieComponent, /controls && \(/);
	assert.match(lottieComponent, /this\.#animation\?\.destroy\(\)/);
});
