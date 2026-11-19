import { hashPassword } from "./password.mjs";

// Read from the terminal, keeping the password out of shell history and stdout.
if (!process.stdin.isTTY)
	throw new Error("Run this command in a terminal. The password prompt reads from stdin.");
process.stderr.write("New admin password (16+ characters): ");
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.stdin.resume();
let password = "";
process.stdin.on("data", (chunk) => {
	for (const char of chunk) {
		if (char === "\u0003") {
			process.stdin.setRawMode(false);
			process.exit(1);
		}
		if (char === "\r" || char === "\n") {
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stderr.write("\n");
			if (password.length < 16 || password.length > 256) {
				process.stderr.write("Use between 16 and 256 characters.\n");
				process.exit(1);
			}
			process.stdout.write(`${hashPassword(password)}\n`);
			process.exit(0);
		}
		if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
		else if (char >= " ") password += char;
	}
});
