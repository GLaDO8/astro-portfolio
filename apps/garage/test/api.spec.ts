import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import vercelEntry from "../api/index";
import { handleRequest } from "../server/index";
import * as production from "../server/production";
import type { GarageEnv } from "../server/types";

const db = new PGlite();
const photos = new Map<string, { data: Uint8Array; type: string }>();
const env: GarageEnv = {
	db,
	clientIp: () => "test-visitor",
	passwordHash:
		"pbkdf2-sha256$100000$00000000000000000000000000000000$a2d56e39986e3d969527cf4166c513dda713312870b4338d5be6d16b014d9b1d",
	photos: {
		async put(key, data, type) {
			photos.set(key, { data, type });
		},
		async exists(key) {
			return photos.has(key);
		},
		async get(key) {
			const photo = photos.get(key);
			return photo
				? new Response(Buffer.from(photo.data), { headers: { "Content-Type": photo.type } })
				: null;
		},
	},
};
const origin = "https://garage.example";
const productId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const requestData = () => ({
	id: crypto.randomUUID(),
	name: "Test Visitor",
	email: "visitor@example.com",
	whatsapp: "",
	bangalore: true,
	city: "",
	productIds: [productId],
});
async function call(
	path: string,
	method = "GET",
	payload?: unknown,
	cookie = "",
	extraHeaders = {},
) {
	return handleRequest(
		new Request(`${origin}${path}`, {
			method,
			headers: {
				Origin: origin,
				...(payload ? { "Content-Type": "application/json" } : {}),
				Cookie: cookie,
				...extraHeaders,
			},
			...(payload ? { body: JSON.stringify(payload) } : {}),
		}),
		env,
	);
}
async function login() {
	const response = await call("/api/login", "POST", { password: "synthetic-garage-password" });
	expect(response.status).toBe(200);
	return response.headers.get("Set-Cookie")?.split(";")[0] ?? "";
}
beforeAll(async () => {
	await db.exec(readFileSync(new URL("../migrations/0001_garage.sql", import.meta.url), "utf8"));
});
afterAll(async () => {
	await db.close();
});
beforeEach(async () => {
	await db.exec("TRUNCATE garage.requests, garage.products, garage.sessions, garage.rate_limits");
	photos.clear();
	await db.query(
		"INSERT INTO garage.products (id, title, description, category, brand, original_url, price_paise, status) VALUES ($1, 'Coffee dripper', 'Used, good condition', 'Coffee', 'Hario', 'https://example.com/dripper', 120050, 'available')",
		[productId],
	);
});

describe("catalog and requests on Postgres", () => {
	it("runs the same handlers through Vercel’s rewritten API entry point", async () => {
		const spy = vi.spyOn(production, "productionEnv").mockReturnValue(env);
		try {
			const catalog = await vercelEntry.fetch(new Request(`${origin}/api?route=products`));
			expect(catalog.status).toBe(200);
			expect((await catalog.json()).products[0].pricePaise).toBe(120050);
			const submitted = await vercelEntry.fetch(
				new Request(`${origin}/api?route=requests`, {
					method: "POST",
					headers: { Origin: origin, "Content-Type": "application/json" },
					body: JSON.stringify(requestData()),
				}),
			);
			expect(submitted.status).toBe(201);
			const unauthenticated = await vercelEntry.fetch(
				new Request(`${origin}/api?route=admin/requests`),
			);
			expect(unauthenticated.status).toBe(401);
		} finally {
			spy.mockRestore();
		}
	});
	it("can reapply the initial migration without losing listings", async () => {
		await db.exec(readFileSync(new URL("../migrations/0001_garage.sql", import.meta.url), "utf8"));
		expect((await db.query("SELECT id FROM garage.products")).rows).toHaveLength(1);
	});
	it("only shows available listings and supports free products", async () => {
		await db.query(
			"INSERT INTO garage.products (id,title,description,category,brand,original_url,price_paise,status) VALUES ($1,'Desk','A desk','Furniture','IKEA','https://example.com',0,'draft')",
			[secondId],
		);
		expect((await (await call("/api/products")).json()).products).toHaveLength(1);
		await db.query("UPDATE garage.products SET price_paise=0 WHERE id=$1", [productId]);
		expect((await call("/api/requests", "POST", requestData())).status).toBe(201);
		const saved = await db.query<{ items: { pricePaise: number }[] }>(
			"SELECT items FROM garage.requests",
		);
		expect(saved.rows[0].items[0].pricePaise).toBe(0);
	});
	it("stores current prices and Bangalore atomically; retries do not duplicate a request", async () => {
		const input = { ...requestData(), pricePaise: 1, city: "Spoofed city" };
		expect((await call("/api/requests", "POST", input)).status).toBe(201);
		await db.query("UPDATE garage.products SET price_paise=400000,status='gone' WHERE id=$1", [
			productId,
		]);
		expect((await call("/api/requests", "POST", input)).status).toBe(201);
		const saved = await db.query<{ city: string; items: { pricePaise: number }[] }>(
			"SELECT city,items FROM garage.requests",
		);
		expect(saved.rows).toHaveLength(1);
		expect(saved.rows[0].city).toBe("Bangalore");
		expect(saved.rows[0].items[0].pricePaise).toBe(120050);
	});
	it("rejects the whole box if any item is unavailable", async () => {
		expect(
			(await call("/api/requests", "POST", { ...requestData(), productIds: [productId, secondId] }))
				.status,
		).toBe(409);
		expect((await db.query("SELECT id FROM garage.requests")).rows).toHaveLength(0);
	});
	it("requires a contact method, city outside Bangalore, and unique items", async () => {
		for (const patch of [
			{ email: "" },
			{ email: "bad" },
			{ bangalore: false, city: "" },
			{ bangalore: "true" },
			{ whatsapp: "12" },
			{ productIds: [productId, productId] },
			{ company: "spam" },
		])
			expect((await call("/api/requests", "POST", { ...requestData(), ...patch })).status).toBe(
				400,
			);
		expect(
			(
				await call("/api/requests", "POST", {
					...requestData(),
					email: "",
					whatsapp: "+91 98765 43210",
					bangalore: false,
					city: "Mumbai",
				})
			).status,
		).toBe(201);
		expect(
			(await db.query<{ city: string }>("SELECT city FROM garage.requests")).rows[0].city,
		).toBe("Mumbai");
	});
	it("limits submissions and keeps buyer details private", async () => {
		for (let i = 0; i < 6; i++)
			expect((await call("/api/requests", "POST", requestData())).status).toBe(201);
		expect((await call("/api/requests", "POST", requestData())).status).toBe(429);
		expect((await call("/api/requests")).status).toBe(404);
		expect((await call("/api/admin/requests")).status).toBe(401);
	});
});
describe("owner access and listings", () => {
	it("preserves whitespace in passwords", async () => {
		const response = await handleRequest(
			new Request(`${origin}/api/login`, {
				method: "POST",
				headers: { Origin: origin, "Content-Type": "application/json" },
				body: JSON.stringify({ password: "  synthetic-garage-password  " }),
			}),
			{
				...env,
				passwordHash:
					"pbkdf2-sha256$100000$00000000000000000000000000000000$2db78a8013aceaa4f06302fe307982f0a4353d53bb84fafdcf330f643e028eac",
			},
		);
		expect(response.status).toBe(200);
	});
	it("rejects cross-origin writes and unauthenticated admin access", async () => {
		expect(
			(
				await call("/api/login", "POST", { password: "synthetic-garage-password" }, "", {
					Origin: "https://other.example",
				})
			).status,
		).toBe(403);
		for (const path of ["/api/admin/products", "/api/admin/requests", "/api/admin/photos"])
			expect((await call(path, "POST", {})).status).toBe(401);
	});
	it("uses secure sessions and revokes expired, rotated, and signed-out sessions", async () => {
		const response = await call("/api/login", "POST", { password: "synthetic-garage-password" });
		const header = response.headers.get("Set-Cookie") ?? "";
		expect(header).toContain("HttpOnly; SameSite=Strict");
		expect(header).toContain("Secure");
		const cookie = header.split(";")[0];
		expect((await call("/api/admin/products", "GET", undefined, cookie)).status).toBe(200);
		expect(
			(
				await handleRequest(
					new Request(`${origin}/api/admin/products`, { headers: { Cookie: cookie } }),
					{ ...env, passwordHash: "rotated" },
				)
			).status,
		).toBe(401);
		await db.query("UPDATE garage.sessions SET expires_at=0");
		expect((await call("/api/admin/products", "GET", undefined, cookie)).status).toBe(401);
		const fresh = await login();
		await call("/api/logout", "POST", undefined, fresh);
		expect((await call("/api/admin/products", "GET", undefined, fresh)).status).toBe(401);
	});
	it("rejects wrong passwords, limits login attempts, and fails closed without a secret", async () => {
		for (let i = 0; i < 5; i++)
			expect((await call("/api/login", "POST", { password: "wrong" })).status).toBe(401);
		expect(
			(await call("/api/login", "POST", { password: "synthetic-garage-password" })).status,
		).toBe(429);
		expect(
			(
				await handleRequest(
					new Request(`${origin}/api/login`, { method: "POST", headers: { Origin: origin } }),
					{ ...env, passwordHash: undefined },
				)
			).status,
		).toBe(503);
	});
	it("creates and edits listings, normalizes category casing, and hides unavailable categories", async () => {
		const cookie = await login();
		const input = {
			title: "Another dripper",
			description: "Unused",
			category: "coffee",
			brand: "Hario",
			originalUrl: "https://example.com/new",
			pricePaise: 0,
			imageKey: null,
			status: "available",
		};
		const created = await call("/api/admin/products", "POST", input, cookie);
		expect(created.status).toBe(201);
		const { id } = await created.json();
		const catalog = await (await call("/api/products")).json();
		expect(catalog.products.every((p: { category: string }) => p.category === "Coffee")).toBe(true);
		expect(
			(await call(`/api/admin/products/${id}`, "PUT", { ...input, status: "reserved" }, cookie))
				.status,
		).toBe(200);
		await db.query("UPDATE garage.products SET status='gone' WHERE id=$1", [productId]);
		expect((await (await call("/api/products")).json()).products).toHaveLength(0);
		for (const patch of [
			{ originalUrl: "javascript:alert(1)" },
			{ pricePaise: -1 },
			{ pricePaise: 1.5 },
			{ imageKey: "https://example.com/image.svg" },
			{ status: "public" },
		])
			expect(
				(await call("/api/admin/products", "POST", { ...input, ...patch }, cookie)).status,
			).toBe(400);
	});
	it("shows requests privately and updates progress", async () => {
		const input = requestData();
		await call("/api/requests", "POST", input);
		const cookie = await login();
		const inbox = await (await call("/api/admin/requests", "GET", undefined, cookie)).json();
		expect(inbox.requests[0].email).toBe(input.email);
		expect(
			(await call(`/api/admin/requests/${input.id}`, "PATCH", { status: "contacted" }, cookie))
				.status,
		).toBe(200);
		expect(
			(await db.query<{ status: string }>("SELECT status FROM garage.requests")).rows[0].status,
		).toBe("contacted");
	});
	it("accepts raster uploads while rejecting SVGs and uploads over Vercel’s safe limit", async () => {
		const cookie = await login();
		const upload = (bytes: Uint8Array) =>
			handleRequest(
				new Request(`${origin}/api/admin/photos`, {
					method: "POST",
					headers: { Origin: origin, Cookie: cookie },
					body: Buffer.from(bytes),
				}),
				env,
			);
		expect((await upload(new TextEncoder().encode("<svg></svg>"))).status).toBe(400);
		expect((await upload(new Uint8Array(4 * 1024 * 1024 + 1))).status).toBe(413);
		const saved = await upload(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]));
		expect(saved.status).toBe(201);
		const { key } = await saved.json();
		const photo = await call(`/api/images/${key}`);
		expect(photo.status).toBe(200);
		expect(photo.headers.get("Content-Type")).toBe("image/png");
		expect((await call(`/api/images/${key}`, "HEAD")).body).toBeNull();
	});
});
