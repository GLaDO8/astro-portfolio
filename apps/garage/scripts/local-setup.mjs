import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localEnv } from "../src/dev/local-env.mjs";
import { hashPassword } from "./password.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const app = new URL("../", import.meta.url);
const secrets = new URL(".env.local", app);
if (!existsSync(secrets)) {
	const password = randomBytes(24).toString("base64url");
	writeFileSync(secrets, `ADMIN_PASSWORD_HASH='${hashPassword(password)}'\n`, { mode: 0o600 });
	writeFileSync(new URL(".local-admin-password", app), `${password}\n`, { mode: 0o600 });
	console.log(
		"Created local credentials. Password: apps/garage/.local-admin-password (ignored by git).",
	);
}
const passwordHash = readFileSync(secrets, "utf8").match(/^ADMIN_PASSWORD_HASH='([^']+)'/m)?.[1];
const env = await localEnv(fileURLToPath(app), passwordHash);
try {
	if (process.argv.includes("--seed")) {
		const fixtures = [
			[
				"11111111-1111-4111-8111-111111111111",
				"V60 coffee dripper",
				"A simple pour-over companion. Size 02, with plenty of mornings still in it.",
				"Coffee",
				"Hario",
				"https://www.hario.com",
				90000,
				"src/assets/sidequests/v60.webp",
			],
			[
				"22222222-2222-4222-8222-222222222222",
				"Digital callipers",
				"For the next thing you’re making. Lightly used, with the original case.",
				"Tools",
				"Generic",
				"https://www.amazon.in",
				120000,
				"src/assets/widgets/callipers.webp",
			],
			[
				"33333333-3333-4333-8333-333333333333",
				"AeroPress coffee maker",
				"A small brewer for a very good cup. Clean, working, and ready for a new routine.",
				"Coffee",
				"AeroPress",
				"https://aeropress.com",
				250000,
				"src/assets/sidequests/aeropress.webp",
			],
			[
				"44444444-4444-4444-8444-444444444444",
				"A trusty claw hammer",
				"A spare from the toolbox. A few marks, a comfortable handle, and a lot of use left.",
				"Tools",
				"Generic",
				"https://www.amazon.in",
				0,
				"src/assets/widgets/hammer.webp",
			],
			[
				"55555555-5555-4555-8555-555555555555",
				"Raspberry Pi board",
				"A starting point for your next weekend project. Board only; bring your own ideas.",
				"Electronics",
				"Raspberry Pi",
				"https://www.raspberrypi.com",
				350000,
				"src/assets/widgets/rpi.webp",
			],
		];

		for (const [id, title, description, category, brand, url, price, file] of fixtures) {
			await env.db.query(
				"INSERT INTO garage.products (id,title,description,category,brand,original_url,price_paise,image_key,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'available') ON CONFLICT (id) DO NOTHING",
				[id, title, description, category, brand, url, price, `${id}.webp`],
			);
			await env.photos.put(`${id}.webp`, readFileSync(path.join(root, file)), "image/webp");
		}
		console.log("Seeded 5 clearly marked local sample listings.");
	}
} finally {
	await env.db.close();
}
