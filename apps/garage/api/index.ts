import { handleRequest } from "../server/index.ts";
import { productionEnv } from "../server/production.ts";

export default {
	async fetch(request: Request) {
		try {
			const url = new URL(request.url);
			const route = url.searchParams.get("route");
			if (route) {
				url.pathname = `/api/${route}`;
				url.searchParams.delete("route");
			}
			return await handleRequest(new Request(url, request), productionEnv());
		} catch {
			console.error("Garage configuration is incomplete.");
			return Response.json(
				{ error: "The garage is not ready yet. Please try again later." },
				{ status: 503, headers: { "Cache-Control": "no-store" } },
			);
		}
	},
};
