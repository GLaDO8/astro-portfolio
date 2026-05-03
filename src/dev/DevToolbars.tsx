import { useEffect, useState } from "react";
import AgentationToolbar from "@/dev/AgentationToolbar";
import DevMeasurer from "@/dev/DevMeasurer";

const getRouteKey = () =>
	`${window.location.pathname}${window.location.search}${window.location.hash}`;

export default function DevToolbars() {
	const [routeKey, setRouteKey] = useState(() =>
		typeof window === "undefined" ? "server" : getRouteKey(),
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncRoute = () => {
			setRouteKey(getRouteKey());
		};

		document.addEventListener("astro:after-swap", syncRoute);
		document.addEventListener("astro:page-load", syncRoute);

		return () => {
			document.removeEventListener("astro:after-swap", syncRoute);
			document.removeEventListener("astro:page-load", syncRoute);
		};
	}, []);

	return (
		<>
			<DevMeasurer key={`measurer:${routeKey}`} />
			<AgentationToolbar key={`agentation:${routeKey}`} />
		</>
	);
}
