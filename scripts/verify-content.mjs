import { spawnSync } from "node:child_process";
import process from "node:process";

const CONTENT_TESTS = [
	"tests/markdoc-link.test.mjs",
	"tests/markdoc-image.test.mjs",
	"tests/markdoc-sidenote.test.mjs",
	"tests/content-images.test.mjs",
	"tests/content-grid-layout.test.mjs",
	"tests/figure-component.test.mjs",
];

function run(command, args) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, { stdio: "inherit" });

	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
		return false;
	}

	return true;
}

if (!run("pnpm", ["exec", "node", "--test", ...CONTENT_TESTS])) {
	process.exit(process.exitCode || 1);
}

if (!run("pnpm", ["run", "build:astro"])) {
	process.exit(process.exitCode || 1);
}
