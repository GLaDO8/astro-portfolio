#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const HEALTH_R2_BUCKET_NAME = "health-raw-data";
const HEALTH_R2_BINDING = "HEALTH_RAW";
const CONFIG = "workers/health-ingest/wrangler.jsonc";
const WRANGLER = ["pnpm", ["exec", "wrangler"]];

function fail(message) {
	console.error(`clear-r2: ${message}`);
	process.exit(1);
}

function runWrangler(args, options = {}) {
	try {
		return execFileSync(WRANGLER[0], [...WRANGLER[1], ...args], {
			cwd: process.cwd(),
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			...options,
		}).trim();
	} catch (error) {
		const detail = error.stderr?.toString().trim() || error.message;
		fail(`Wrangler failed: ${detail}`);
	}
}

function assertHardcodedBucketBinding() {
	const config = readFileSync(CONFIG, "utf8");
	const expectedBinding = new RegExp(
		`"binding"\\s*:\\s*"${HEALTH_R2_BINDING}"[\\s\\S]{0,200}?"bucket_name"\\s*:\\s*"${HEALTH_R2_BUCKET_NAME}"`,
	);
	if (!expectedBinding.test(config)) {
		fail(
			`hardcoded target ${HEALTH_R2_BUCKET_NAME} no longer matches ${HEALTH_R2_BINDING} in ${CONFIG}`,
		);
	}
}

function getAuth() {
	let identity;
	try {
		identity = JSON.parse(runWrangler(["whoami", "--json"]));
	} catch {
		fail("could not parse `wrangler whoami --json`");
	}
	if (!identity.loggedIn) fail("Wrangler is not authenticated");

	const configuredAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
	const account = configuredAccount
		? identity.accounts.find(({ id }) => id === configuredAccount)
		: identity.accounts.length === 1
			? identity.accounts[0]
			: undefined;
	if (!account) {
		fail(
			configuredAccount
				? "CLOUDFLARE_ACCOUNT_ID is not available to the current Wrangler identity"
				: "multiple Cloudflare accounts are available; set CLOUDFLARE_ACCOUNT_ID explicitly",
		);
	}

	let credentials;
	try {
		credentials = JSON.parse(runWrangler(["auth", "token", "--json"]));
	} catch {
		fail("could not parse `wrangler auth token --json`");
	}
	if (typeof credentials.token !== "string" || !credentials.token) {
		fail("this workflow requires Wrangler OAuth or an API token, not a global API key");
	}
	return { accountId: account.id, token: credentials.token };
}

async function listObjects() {
	const { accountId, token } = getAuth();
	const objects = [];
	let cursor;

	do {
		const url = new URL(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${HEALTH_R2_BUCKET_NAME}/objects`,
		);
		url.searchParams.set("per_page", "1000");
		if (cursor) url.searchParams.set("cursor", cursor);

		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = await response.json();
		if (!response.ok || !body.success) {
			const message = body.errors?.map(({ message: text }) => text).join("; ") || response.statusText;
			fail(`R2 list failed: ${message}`);
		}

		for (const object of body.result ?? []) {
			if (typeof object.key !== "string" || typeof object.size !== "number") {
				fail("R2 list returned an object without a key or size");
			}
			objects.push({
				key: object.key,
				size: object.size,
				etag: object.etag ?? null,
				lastModified: object.last_modified ?? null,
			});
		}

		cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
		if (body.result_info?.is_truncated && !cursor) fail("R2 pagination was truncated without a cursor");
	} while (cursor);

	objects.sort((a, b) => a.key.localeCompare(b.key));
	return objects;
}

function summarize(objects) {
	return {
		count: objects.length,
		bytes: objects.reduce((sum, object) => sum + object.size, 0),
		firstKey: objects[0]?.key ?? null,
		lastKey: objects.at(-1)?.key ?? null,
	};
}

function sameSnapshot(expected, observed) {
	if (expected.length !== observed.length) return false;
	return expected.every((object, index) => {
		const current = observed[index];
		return (
			object.key === current.key &&
			object.size === current.size &&
			(object.etag ?? null) === (current.etag ?? null)
		);
	});
}

async function prepare() {
	const objects = await listObjects();
	const summary = summarize(objects);
	const directory = mkdtempSync(join(tmpdir(), "health-r2-clear-"));
	const manifestPath = join(directory, "manifest.json");
	const manifest = {
		version: 1,
		bucket: HEALTH_R2_BUCKET_NAME,
		createdAt: new Date().toISOString(),
		...summary,
		objects,
	};
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
	console.log(JSON.stringify({ phase: "prepared", manifestPath, ...summary }, null, 2));
}

function readManifest(path) {
	let manifest;
	try {
		manifest = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		fail(`could not read manifest: ${error.message}`);
	}
	if (
		manifest.version !== 1 ||
		manifest.bucket !== HEALTH_R2_BUCKET_NAME ||
		!Array.isArray(manifest.objects)
	) {
		fail("manifest does not describe the expected health R2 snapshot");
	}
	const summary = summarize(manifest.objects);
	if (summary.count !== manifest.count || summary.bytes !== manifest.bytes) {
		fail("manifest count or byte total is internally inconsistent");
	}
	return manifest;
}

function deleteObject(key) {
	const result = spawnSync(
		WRANGLER[0],
		[
			...WRANGLER[1],
			"r2",
			"object",
			"delete",
			`${HEALTH_R2_BUCKET_NAME}/${key}`,
			"--remote",
			"--force",
			"--config",
			CONFIG,
		],
		{ cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
	if (result.status !== 0) {
		const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
		throw new Error(`failed to delete ${JSON.stringify(key)}: ${detail}`);
	}
}

async function execute(manifestPath) {
	const manifest = readManifest(manifestPath);
	const fresh = await listObjects();
	if (!sameSnapshot(manifest.objects, fresh)) {
		fail("the live bucket drifted from the confirmed manifest; run prepare and confirm the new snapshot");
	}

	let completed = 0;
	let deletionError = null;
	try {
		for (const object of manifest.objects) {
			deleteObject(object.key);
			completed += 1;
			if (completed % 25 === 0 || completed === manifest.objects.length) {
				console.error(`Deleted ${completed}/${manifest.objects.length} frozen objects`);
			}
		}
	} catch (error) {
		deletionError = error;
		console.error(`clear-r2: ${error.message}`);
	}

	const remaining = await listObjects();
	const remainingKeys = new Set(remaining.map(({ key }) => key));
	const undeletedTargets = manifest.objects.filter(({ key }) => remainingKeys.has(key));
	const targetKeys = new Set(manifest.objects.map(({ key }) => key));
	const laterArrivals = remaining.filter(({ key }) => !targetKeys.has(key));

	const report = {
		phase: undeletedTargets.length === 0 ? "complete" : "incomplete",
		deletedObjects: manifest.count - undeletedTargets.length,
		deletedBytes:
			manifest.bytes - undeletedTargets.reduce((sum, object) => sum + object.size, 0),
		undeletedTargets: undeletedTargets.length,
		laterArrivals: summarize(laterArrivals),
	};
	if (deletionError) report.phase = "incomplete";
	console.log(JSON.stringify(report, null, 2));
	if (deletionError || undeletedTargets.length > 0) process.exit(1);
}

const [command, manifestPath] = process.argv.slice(2);
assertHardcodedBucketBinding();
if (command === "prepare" && !manifestPath) {
	await prepare();
} else if (command === "execute" && manifestPath) {
	await execute(manifestPath);
} else {
	fail("usage: clear-r2.mjs prepare | clear-r2.mjs execute /absolute/path/to/manifest.json");
}
