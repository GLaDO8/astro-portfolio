import { sessionCookie, sha256, verifyPassword } from "./auth.ts";
import type { GarageEnv } from "./types.ts";
import { HttpError, productInput, requestInput } from "./validation.ts";

const columns = `id, title, description, category, brand, original_url AS "originalUrl", price_paise AS "pricePaise", image_key AS "imageKey", status`;
const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
	Response.json(data, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
	});
async function limitedBody(request: Request, limit: number) {
	if (Number(request.headers.get("Content-Length")) > limit)
		throw new HttpError(413, "This upload is too large. Choose a photo under 4 MB.");
	const reader = request.body?.getReader();
	if (!reader) return new Uint8Array();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			throw new HttpError(413, "This upload is too large. Choose a photo under 4 MB.");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}
async function body(request: Request) {
	if (!request.headers.get("Content-Type")?.startsWith("application/json"))
		throw new HttpError(415, "Send this form as JSON.");
	const bytes = await limitedBody(request, 24000);
	try {
		const data = JSON.parse(new TextDecoder().decode(bytes));
		if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
		return data as Record<string, unknown>;
	} catch {
		throw new HttpError(400, "Check the form and try again.");
	}
}
async function rateLimit(
	request: Request,
	env: GarageEnv,
	scope: string,
	max: number,
	seconds: number,
) {
	const now = Math.floor(Date.now() / 1000);
	const window = Math.floor(now / seconds);
	const key = await sha256(`${scope}:${env.clientIp(request)}:${window}`);
	const result = await env.db.query<{ attempts: number }>(
		"INSERT INTO garage.rate_limits (key, attempts, expires_at) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET attempts = garage.rate_limits.attempts + 1 RETURNING attempts",
		[key, (window + 1) * seconds],
	);
	await env.db.query("DELETE FROM garage.rate_limits WHERE expires_at < $1", [now]);
	if (!result.rows[0] || result.rows[0].attempts > max)
		throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(seconds / 60)} minutes.`);
}
async function session(request: Request, env: GarageEnv) {
	const token = request.headers
		.get("Cookie")
		?.match(/(?:^|;\s*)garage_session=([a-f0-9-]{72})(?:;|$)/)?.[1];
	if (!token || !env.passwordHash) return null;
	const hash = await sha256(`${env.passwordHash}:${token}`);
	const result = await env.db.query(
		"SELECT token_hash FROM garage.sessions WHERE token_hash = $1 AND expires_at > $2",
		[hash, Date.now()],
	);
	return result.rows.length ? hash : null;
}
async function handle(request: Request, env: GarageEnv): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname.replace(/\/$/, "");
	if (!["GET", "HEAD"].includes(request.method) && request.headers.get("Origin") !== url.origin)
		throw new HttpError(403, "Open this website directly and try again.");
	if (path === "/api/products" && request.method === "GET")
		return json({
			products: (
				await env.db.query(
					`SELECT ${columns} FROM garage.products WHERE status = 'available' ORDER BY created_at DESC, id`,
				)
			).rows,
			demo: Boolean(env.demo),
		});
	if (path === "/api/session" && request.method === "GET")
		return json({ authenticated: Boolean(await session(request, env)) });
	if (path === "/api/login" && request.method === "POST") {
		if (!env.passwordHash) throw new HttpError(503, "Admin login is not configured yet.");
		if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
			throw new HttpError(403, "Use the HTTPS address to sign in.");
		await rateLimit(request, env, "login", 5, 900);
		const { password } = await body(request);
		if (typeof password !== "string" || !password.length || password.length > 256)
			throw new HttpError(400, "Enter your password (up to 256 characters).");
		if (!(await verifyPassword(password, env.passwordHash)))
			throw new HttpError(401, "That password didn’t match. Try again.");
		const token = crypto.randomUUID() + crypto.randomUUID();
		const hash = await sha256(`${env.passwordHash}:${token}`);
		await env.db.query("DELETE FROM garage.sessions WHERE expires_at < $1", [Date.now()]);
		await env.db.query("INSERT INTO garage.sessions (token_hash, expires_at) VALUES ($1, $2)", [
			hash,
			Date.now() + 43200000,
		]);
		return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token, url) });
	}
	if (path === "/api/logout" && request.method === "POST") {
		const hash = await session(request, env);
		if (hash) await env.db.query("DELETE FROM garage.sessions WHERE token_hash = $1", [hash]);
		return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", url, 0) });
	}
	if (path === "/api/requests" && request.method === "POST") {
		const input = requestInput(await body(request));
		await rateLimit(request, env, "requests", 6, 3600);
		// Availability and price snapshots are selected in one atomic statement.
		const result = await env.db.query(
			`INSERT INTO garage.requests (id, name, email, whatsapp, city, items)
			SELECT $1, $2, $3, $4, $5, jsonb_agg(jsonb_build_object('id', id, 'title', title, 'pricePaise', price_paise) ORDER BY id)
			FROM garage.products WHERE id = ANY($6::text[]) AND status = 'available' HAVING count(*) = $7
			ON CONFLICT (id) DO NOTHING RETURNING id`,
			[
				input.id,
				input.name,
				input.email,
				input.whatsapp,
				input.city,
				input.productIds,
				input.productIds.length,
			],
		);
		if (
			!result.rows.length &&
			!(await env.db.query("SELECT id FROM garage.requests WHERE id = $1", [input.id])).rows.length
		)
			throw new HttpError(
				409,
				"Something in your box is no longer available. Refresh the page, review your box, and try again.",
			);
		return json({ ok: true, id: input.id }, 201);
	}
	if (path.startsWith("/api/admin/")) {
		if (!(await session(request, env)))
			throw new HttpError(401, "Your session has ended. Sign in again.");
		if (path === "/api/admin/products" && request.method === "GET")
			return json({
				products: (
					await env.db.query(`SELECT ${columns} FROM garage.products ORDER BY created_at DESC, id`)
				).rows,
			});
		const productMatch = path.match(/^\/api\/admin\/products\/([a-f0-9-]{36})$/);
		if (
			(path === "/api/admin/products" && request.method === "POST") ||
			(productMatch && request.method === "PUT")
		) {
			const p = productInput(await body(request));
			if (p.imageKey && !(await env.photos.exists(p.imageKey)))
				throw new HttpError(400, "This photo is missing. Upload it again.");
			const canonical = await env.db.query<{ category: string }>(
				"SELECT category FROM garage.products WHERE lower(category) = lower($1) ORDER BY created_at LIMIT 1",
				[p.category],
			);
			p.category = canonical.rows[0]?.category ?? p.category;
			const id = productMatch?.[1] ?? crypto.randomUUID();
			const values = [
				p.title,
				p.description,
				p.category,
				p.brand,
				p.originalUrl,
				p.pricePaise,
				p.imageKey,
				p.status,
				id,
			];
			const result = productMatch
				? await env.db.query(
						"UPDATE garage.products SET title=$1, description=$2, category=$3, brand=$4, original_url=$5, price_paise=$6, image_key=$7, status=$8, updated_at=now() WHERE id=$9 RETURNING id",
						values,
					)
				: await env.db.query(
						"INSERT INTO garage.products (title, description, category, brand, original_url, price_paise, image_key, status, id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
						values,
					);
			if (!result.rows.length)
				throw new HttpError(404, "This listing no longer exists. Reload the page.");
			return json({ id }, productMatch ? 200 : 201);
		}
		if (path === "/api/admin/photos" && request.method === "POST") {
			const bytes = await limitedBody(request, 4 * 1024 * 1024);
			const kind =
				bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
					? "jpg"
					: [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
						? "png"
						: new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
								new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
							? "webp"
							: null;
			if (!kind) throw new HttpError(400, "Choose a JPG, PNG, or WebP photo under 4 MB.");
			const key = `${crypto.randomUUID()}.${kind}`;
			await env.photos.put(key, bytes, `image/${kind === "jpg" ? "jpeg" : kind}`);
			return json({ key }, 201);
		}
		if (path === "/api/admin/requests" && request.method === "GET")
			return json({
				requests: (
					await env.db.query(
						'SELECT id, name, email, whatsapp, city, items, status, created_at AS "createdAt" FROM garage.requests ORDER BY created_at DESC, id',
					)
				).rows,
			});
		const requestMatch = path.match(/^\/api\/admin\/requests\/([a-f0-9-]{36})$/);
		if (requestMatch && request.method === "PATCH") {
			const { status } = await body(request);
			if (!["new", "contacted", "closed"].includes(String(status)))
				throw new HttpError(400, "Choose a valid request status.");
			const result = await env.db.query(
				"UPDATE garage.requests SET status = $1 WHERE id = $2 RETURNING id",
				[status, requestMatch[1]],
			);
			if (!result.rows.length)
				throw new HttpError(404, "This request no longer exists. Reload the page.");
			return json({ ok: true });
		}
	}
	const imageMatch = path.match(/^\/api\/images\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/);
	if (imageMatch && ["GET", "HEAD"].includes(request.method)) {
		const response = await env.photos.get(imageMatch[1]);
		if (!response) throw new HttpError(404, "Photo not found.");
		return request.method === "HEAD"
			? new Response(null, { status: response.status, headers: response.headers })
			: response;
	}
	throw new HttpError(404, "This page could not be found.");
}
export async function handleRequest(request: Request, env: GarageEnv) {
	try {
		return await handle(request, env);
	} catch (error) {
		if (error instanceof HttpError) return json({ error: error.message }, error.status);
		console.error("Garage request failed.");
		return json({ error: "Something went wrong. Please try again in a moment." }, 500);
	}
}
