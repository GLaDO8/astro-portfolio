import { createElement, useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

export type CADModel = {
	readonly id: string;
	readonly src: string;
	readonly alt: string;
};

type CADRenderProps = {
	readonly model: CADModel;
	readonly className?: string;
};

const shadowScrollbarStyleId = "cad-render-scrollbar-reset";
const shadowScrollbarReset = `
:host,
* {
	-ms-overflow-style: none;
	scrollbar-width: none;
}

:host::-webkit-scrollbar,
*::-webkit-scrollbar {
	display: none;
	width: 0;
	height: 0;
}
`;

const figureClassName = cn(
	"relative aspect-square min-h-48 overflow-hidden rounded-lg",
	"border-[0.75rem] border-white bg-[#3182d9] bg-center",
	"bg-[image:linear-gradient(rgba(255,255,255,0.2)_2px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_2px,transparent_1px)]",
	"bg-[length:2.1rem_2.1rem] shadow-[0_1.5rem_3rem_rgba(42,35,29,0.14)]",
);

const modelViewerClassName = cn(
	"relative z-[1] block h-full w-full overflow-hidden",
	"[--poster-color:transparent]",
	"[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

export function hideCADModelViewerScrollbars(viewer: HTMLElement) {
	const shadowRoot = viewer.shadowRoot;

	if (!shadowRoot || shadowRoot.getElementById(shadowScrollbarStyleId)) {
		return;
	}

	const style = document.createElement("style");
	style.id = shadowScrollbarStyleId;
	style.textContent = shadowScrollbarReset;
	shadowRoot.append(style);
}

export default function CADRender({ model, className }: CADRenderProps) {
	const modelViewerRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const viewer = modelViewerRef.current;

		if (!viewer) {
			return;
		}

		let isDisposed = false;

		const handleModelLoad = () => {
			hideCADModelViewerScrollbars(viewer);
		};

		viewer.addEventListener("load", handleModelLoad);

		void import("@google/model-viewer").then(() => {
			if (!isDisposed) {
				hideCADModelViewerScrollbars(viewer);
			}
		});

		return () => {
			isDisposed = true;
			viewer.removeEventListener("load", handleModelLoad);
		};
	}, []);

	return (
		<figure className={cn(figureClassName, className)}>
			{createElement("model-viewer", {
				ref: modelViewerRef,
				src: model.src,
				alt: model.alt,
				"auto-rotate": "",
				"auto-rotate-delay": "0",
				"camera-controls": "",
				"disable-zoom": "",
				"interaction-prompt": "none",
				loading: "lazy",
				reveal: "auto",
				"rotation-per-second": "48deg",
				"shadow-intensity": "0",
				"touch-action": "pan-y",
				"data-cad-model": model.id,
				"data-sidequests-pan-ignore": "",
				className: modelViewerClassName,
			})}
		</figure>
	);
}
