import { type CSSProperties, createElement } from "react";

export type CADModel = {
	readonly id: string;
	readonly src: string;
	readonly alt: string;
};

type CADRenderProps = {
	readonly model: CADModel;
};

const modelViewerStyle = {
	"--poster-color": "transparent",
} as CSSProperties;

export default function CADRender({ model }: CADRenderProps) {
	return (
		<figure className="cad-render">
			{createElement("model-viewer", {
				src: model.src,
				alt: model.alt,
				"auto-rotate": "",
				"auto-rotate-delay": "0",
				"camera-controls": "",
				"interaction-prompt": "none",
				loading: "lazy",
				reveal: "auto",
				"rotation-per-second": "48deg",
				"shadow-intensity": "0",
				"touch-action": "pan-y",
				"data-cad-model": model.id,
				"data-sidequests-pan-ignore": "",
				className: "cad-render__model",
				style: modelViewerStyle,
			})}

			<style>{`
				.cad-render {
					--cad-render-blueprint: #3182d9;
					position: relative;
					aspect-ratio: 1;
					min-height: 12rem;
					overflow: hidden;
					border: 0.75rem solid white;
					border-radius: 0.5rem;
					background-color: var(--cad-render-blueprint);
					background-image:
						linear-gradient(rgba(255, 255, 255, 0.2) 2px, transparent 1px),
						linear-gradient(90deg, rgba(255, 255, 255, 0.2) 2px, transparent 1px);
					background-position: center;
					background-size: 2.1rem 2.1rem;
					box-shadow: 0 1.5rem 3rem rgba(42, 35, 29, 0.14);
				}

				.cad-render__model {
					position: relative;
					z-index: 1;
					display: block;
					width: 100%;
					height: 100%;
				}
			`}</style>
		</figure>
	);
}
