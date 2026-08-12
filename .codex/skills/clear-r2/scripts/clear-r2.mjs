#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const HEALTH_R2_BUCKET_NAME = "health-raw-data";
const HEALTH_R2_BINDING = "HEALTH_RAW";
const CONFIG = "workers/health-ingest/wrangler.jsonc";
const DELETE_CONCURRENCY = 20;

function fail(message) {
	console.error(`clear-r2: ${message}`);
	process.exit(1);
}

function runWrangler(args) {
	try {
		return execFileSync("pnpm", ["exec", "wrangler", ...args], {
			cwd: process.cwd(),
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (error) {
		fail(error.stderr?.toString().trim() || error.message);
	}
}

function assertTarget() {
	const config = readFileSync(CONFIG, "utf8");
	const expectedBinding = new RegExp(
		`"binding"\\s*:\\s*"${HEALTH_R2_BINDING}"[\\s\\S]{0,200}?"bucket_name"\\s*:\\s*"${HEALTH_R2_BUCKET_NAME}"`,
	);
	if (!expectedBinding.test(config)) {
		fail(`${HEALTH_R2_BUCKET_NAME} no longer matches ${HEALTH_R2_BINDING} in ${CONFIG}`);
	}
}

function getAuth() {
	let identity;
	let credentials;
	try {
		identity = JSON.parse(runWrangler(["whoami", "--json"]));
		credentials = JSON.parse(runWrangler(["auth", "token", "--json"]));
	} catch {
		fail("could not read Wrangler authentication");
	}
	if (!identity.loggedIn || typeof credentials.token !== "string" || !credentials.token) {
		fail("Wrangler OAuth or API-token authentication is required");
	}

	const configuredAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
	const account = configuredAccount
		? identity.accounts.find(({ id }) => id === configuredAccount)
		: identity.accounts.length === 1
			? identity.accounts[0]
			: undefined;
	if (!account) fail("set CLOUDFLARE_ACCOUNT_ID because Wrangler has multiple accounts");
	return { accountId: account.id, token: credentials.token };
}

function collectionUrl(accountId) {
	return `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${HEALTH_R2_BUCKET_NAME}/objects`;
}

async function readResponse(response, action) {
	let body;
	try {
		body = await response.json();
	} catch {
		fail(`${action} returned a non-JSON response (${response.status})`);
	}
	if (!response.ok || !body.success) {
		const message = body.errors?.map(({ message: text }) => text).join("; ") || response.statusText;
		fail(`${action} failed: ${message}`);
	}
	return body;
}

async function listObjects(auth) {
	const objects = [];
	let cursor;
	do {
		const url = new URL(collectionUrl(auth.accountId));
		url.searchParams.set("per_page", "1000");
		if (cursor) url.searchParams.set("cursor", cursor);
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${auth.token}` },
		});
		const body = await readResponse(response, "R2 list");
		for (const object of body.result ?? []) {
			if (typeof object.key !== "string" || typeof object.size !== "number") {
				fail("R2 list returned invalid object metadata");
			}
			objects.push({ key: object.key, size: object.size });
		}
		cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
		if (body.result_info?.is_truncated && !cursor) fail("R2 list omitted its pagination cursor");
	} while (cursor);
	return objects;
}

function objectUrl(accountId, key) {
	const encodedKey = key.split("/").map(encodeURIComponent).join("/");
	return `${collectionUrl(accountId)}/${encodedKey}`;
}

async function deleteObject(auth, key) {
	const response = await fetch(objectUrl(auth.accountId, key), {
		method: "DELETE",
		headers: { Authorization: `Bearer ${auth.token}` },
	});
	await readResponse(response, "R2 delete");
}

async function clearSnapshot(auth, snapshot) {
	for (let index = 0; index < snapshot.length; index += DELETE_CONCURRENCY) {
		await Promise.all(
			snapshot
				.slice(index, index + DELETE_CONCURRENCY)
				.map(({ key }) => deleteObject(auth, key)),
		);
	}
}

if (process.argv.length !== 2) fail("this command does not accept arguments");
assertTarget();
const auth = getAuth();
const snapshot = await listObjects(auth);
const bytes = snapshot.reduce((sum, object) => sum + object.size, 0);

if (snapshot.length > 0) await clearSnapshot(auth, snapshot);

const remaining = await listObjects(auth);
const targetKeys = new Set(snapshot.map(({ key }) => key));
const undeleted = remaining.filter(({ key }) => targetKeys.has(key));
if (undeleted.length > 0) fail(`${undeleted.length} snapshotted object(s) remain`);

console.log(
	JSON.stringify({
		bucket: HEALTH_R2_BUCKET_NAME,
		deletedObjects: snapshot.length,
		deletedBytes: bytes,
		laterArrivals: remaining.length,
	}),
);
