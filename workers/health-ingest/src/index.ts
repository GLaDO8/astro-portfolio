const JSON_HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		status,
		headers: { ...JSON_HEADERS, ...headers },
	});
}

async function checkBindings(env: Env): Promise<Response> {
	try {
		const [databaseResult] = await Promise.all([
			env.HEALTH_DB.prepare("SELECT 1 AS healthy").first<{ healthy: number }>(),
			env.HEALTH_RAW.head("__healthcheck__"),
		]);

		if (databaseResult?.healthy !== 1) {
			throw new Error("D1 health check returned an unexpected result");
		}

		return json({ status: "ok" });
	} catch (error) {
		console.error(
			JSON.stringify({
				message: "Cloudflare binding health check failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);

		return json({ status: "unavailable" }, 503);
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== "/health") {
			return json({ error: "Not found" }, 404);
		}

		if (request.method !== "GET") {
			return json({ error: "Method not allowed" }, 405, { allow: "GET" });
		}

		return checkBindings(env);
	},
} satisfies ExportedHandler<Env>;
