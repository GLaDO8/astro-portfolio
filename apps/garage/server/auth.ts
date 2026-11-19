const encoder = new TextEncoder();
const hex = (data: ArrayBuffer) =>
	Array.from(new Uint8Array(data), (v) => v.toString(16).padStart(2, "0")).join("");

export async function sha256(value: string) {
	return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function verifyPassword(password: string, encoded: string) {
	const [scheme, iterations, salt, expected] = encoded.split("$");
	if (
		scheme !== "pbkdf2-sha256" ||
		iterations !== "100000" ||
		!/^[a-f0-9]{32}$/.test(salt ?? "") ||
		!/^[a-f0-9]{64}$/.test(expected ?? "")
	)
		return false;
	const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const actual = hex(
		await crypto.subtle.deriveBits(
			{ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100000 },
			key,
			256,
		),
	);
	let difference = 0;
	for (let i = 0; i < actual.length; i++)
		difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
	return difference === 0;
}

export function sessionCookie(token: string, url: URL, maxAge = 43200) {
	return `garage_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${url.protocol === "https:" ? "; Secure" : ""}`;
}
