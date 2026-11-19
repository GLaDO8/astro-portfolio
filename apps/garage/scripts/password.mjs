import { pbkdf2Sync, randomBytes } from "node:crypto";

export function hashPassword(password) {
	const salt = randomBytes(16).toString("hex");
	return `pbkdf2-sha256$100000$${salt}$${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex")}`;
}
