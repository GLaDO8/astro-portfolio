import type { BoxItem } from "./types";

export const money = (paise: number) =>
	paise === 0
		? "Free"
		: new Intl.NumberFormat("en-IN", {
				style: "currency",
				currency: "INR",
				maximumFractionDigits: paise % 100 ? 2 : 0,
			}).format(paise / 100);
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		...options,
		headers: {
			...(options.body && !(options.body instanceof File)
				? { "Content-Type": "application/json" }
				: {}),
			...options.headers,
		},
	});
	const result = await response.json();
	if (!response.ok)
		throw new ApiError(result.error ?? "Something went wrong. Try again.", response.status);
	return result;
}
export function readBox(): BoxItem[] {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem("garage.box.v1") ?? "[]");
		if (!Array.isArray(stored)) return [];
		return stored
			.filter((p): p is BoxItem => p && typeof p.id === "string" && typeof p.title === "string")
			.slice(0, 30)
			.filter((p, i, all) => all.findIndex((v) => v.id === p.id) === i);
	} catch {
		return [];
	}
}
