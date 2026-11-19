export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

export function text(value: unknown, label: string, max: number, required = true) {
	if (typeof value !== "string" || value.trim().length > max || (required && !value.trim()))
		throw new HttpError(400, `Enter ${label}${max ? ` (up to ${max} characters)` : ""}.`);
	return value.trim();
}

export function productInput(body: Record<string, unknown>) {
	const title = text(body.title, "a product name", 120);
	const description = text(body.description, "a description", 4000);
	const category = text(body.category, "a category", 50).replace(/\s+/g, " ");
	const brand = text(body.brand, "the original brand", 80);
	const originalUrl = text(body.originalUrl, "the original product link", 2000);
	try {
		if (new URL(originalUrl).protocol !== "https:") throw new Error();
	} catch {
		throw new HttpError(400, "Enter a full original product link starting with https://.");
	}
	if (
		!Number.isSafeInteger(body.pricePaise) ||
		(body.pricePaise as number) < 0 ||
		(body.pricePaise as number) > 1000000000
	)
		throw new HttpError(400, "Enter a valid price, or mark the product as free.");
	if (!["draft", "available", "reserved", "gone"].includes(String(body.status)))
		throw new HttpError(400, "Choose a valid availability.");
	const imageKey =
		body.imageKey === null || body.imageKey === "" ? null : text(body.imageKey, "a photo", 100);
	if (imageKey && !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(imageKey))
		throw new HttpError(400, "Upload a product photo again.");
	return {
		title,
		description,
		category,
		brand,
		originalUrl,
		pricePaise: body.pricePaise as number,
		status: String(body.status),
		imageKey,
	};
}

export function requestInput(body: Record<string, unknown>) {
	const id = text(body.id, "a request ID", 36);
	if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(400, "Reload the page and try again.");
	const name = text(body.name, "your name", 120);
	const email = text(body.email ?? "", "your email", 254, false);
	const whatsapp = text(body.whatsapp ?? "", "your WhatsApp number", 30, false).replace(
		/[\s()-]/g,
		"",
	);
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new HttpError(400, "Enter a valid email address.");
	if (whatsapp && !/^\+?[1-9]\d{7,14}$/.test(whatsapp))
		throw new HttpError(400, "Enter your WhatsApp number with its country code.");
	if (!email && !whatsapp)
		throw new HttpError(400, "Add an email address or WhatsApp number so I can get back to you.");
	if (typeof body.bangalore !== "boolean") throw new HttpError(400, "Choose your city.");
	const city = body.bangalore ? "Bangalore" : text(body.city, "your city", 100);
	if (
		!Array.isArray(body.productIds) ||
		!body.productIds.length ||
		body.productIds.length > 30 ||
		body.productIds.some((v) => typeof v !== "string" || !/^[a-f0-9-]{36}$/.test(v)) ||
		new Set(body.productIds).size !== body.productIds.length
	)
		throw new HttpError(400, "Choose between 1 and 30 different products for your box.");
	if (body.company) throw new HttpError(400, "Leave the company field empty and try again.");
	return { id, name, email, whatsapp, city, productIds: body.productIds as string[] };
}
