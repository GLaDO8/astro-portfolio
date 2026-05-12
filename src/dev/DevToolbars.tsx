import { useEffect, useState } from "react";
import AgentationToolbar from "@/dev/AgentationToolbar";
import DevMeasurer from "@/dev/DevMeasurer";
import { devOverlayStylePreserver } from "@/dev/devOverlayStyles.js";
import SidequestsPositioner from "@/dev/SidequestsPositioner";

type AstroBeforeSwapEvent = Event & {
	newDocument?: Document;
};

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

		const preserveOverlayStylesForSwap = (event: Event) => {
			devOverlayStylePreserver.copy({
				sourceDocument: document,
				targetDocument: (event as AstroBeforeSwapEvent).newDocument,
			});
		};

		const restoreOverlayStyles = () => {
			devOverlayStylePreserver.copy();
		};

		restoreOverlayStyles();

		document.addEventListener("astro:before-swap", preserveOverlayStylesForSwap);
		document.addEventListener("astro:after-swap", syncRoute);
		document.addEventListener("astro:page-load", syncRoute);
		document.addEventListener("astro:after-swap", restoreOverlayStyles);
		document.addEventListener("astro:page-load", restoreOverlayStyles);

		return () => {
			document.removeEventListener("astro:before-swap", preserveOverlayStylesForSwap);
			document.removeEventListener("astro:after-swap", syncRoute);
			document.removeEventListener("astro:page-load", syncRoute);
			document.removeEventListener("astro:after-swap", restoreOverlayStyles);
			document.removeEventListener("astro:page-load", restoreOverlayStyles);
		};
	}, []);

	return (
		<>
			<DevMeasurer key={`measurer:${routeKey}`} />
			<AgentationToolbar key={`agentation:${routeKey}`} />
			<SidequestsPositioner key={`sidequests-positioner:${routeKey}`} />
		</>
	);
}
