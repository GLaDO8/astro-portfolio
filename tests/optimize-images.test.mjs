import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { optimizeImage } from "../scripts/optimize-images.mjs";

async function writeLargePng(path) {
	const width = 400;
	const height = 300;
	const pixels = Buffer.alloc(width * height * 3);
	let seed = 123_456_789;

	for (let index = 0; index < pixels.length; index++) {
		seed = (1_664_525 * seed + 1_013_904_223) >>> 0;
		pixels[index] = seed & 255;
	}

	await sharp(pixels, {
		raw: {
			width,
			height,
			channels: 3,
		},
	})
		.png({ compressionLevel: 0 })
		.toFile(path);
}

test("image optimizer converts assets to webp and rewrites Markdown image references", async () => {
	const originalCwd = process.cwd();
	const workspace = await mkdtemp(join(tmpdir(), "site-image-refs-"));

	try {
		process.chdir(workspace);
		await mkdir("src/assets/notes/example", { recursive: true });
		await mkdir("src/content/notes", { recursive: true });
		await mkdir("src/components", { recursive: true });

		await writeLargePng("src/assets/notes/example/chart.png");
		await writeFile("src/content/notes/example.mdoc", "![Chart](/notes/example/chart.png)\n");
		await writeFile(
			"src/components/Example.astro",
			'---\nconst src = "@/assets/notes/example/chart.png";\n---\n',
		);

		assert.equal(await optimizeImage("src/assets/notes/example/chart.png"), true);
		await access("src/assets/notes/example/chart.webp");
		await assert.rejects(access("src/assets/notes/example/chart.png"), { code: "ENOENT" });

		assert.equal(
			await readFile("src/content/notes/example.mdoc", "utf8"),
			"![Chart](/notes/example/chart.webp)\n",
		);
		assert.match(
			await readFile("src/components/Example.astro", "utf8"),
			/"@\/assets\/notes\/example\/chart.webp"/,
		);
	} finally {
		process.chdir(originalCwd);
		await rm(workspace, { recursive: true, force: true });
	}
});
