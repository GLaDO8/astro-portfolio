import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef } from "react";

type SidequestsCanvasProps = {
	readonly children: ReactNode;
	readonly ariaLabel?: string;
};

type CanvasPosition = {
	readonly x: number;
	readonly y: number;
};

type ActiveDrag = {
	readonly pointerId: number;
	readonly startX: number;
	readonly startY: number;
	readonly originX: number;
	readonly originY: number;
};

type CADMaterial = {
	readonly pbrMetallicRoughness?: {
		setBaseColorFactor(color: [number, number, number, number]): void;
		setMetallicFactor(value: number): void;
		setRoughnessFactor(value: number): void;
	};
};

type CADModelViewerElement = HTMLElement & {
	readonly model?: {
		readonly materials?: readonly CADMaterial[];
	};
};

const cadMaterialColor: [number, number, number, number] = [220 / 255, 220 / 255, 220 / 255, 1];

function applyCADMaterial(viewer: CADModelViewerElement) {
	for (const material of viewer.model?.materials ?? []) {
		material.pbrMetallicRoughness?.setBaseColorFactor(cadMaterialColor);
		material.pbrMetallicRoughness?.setMetallicFactor(0.7);
		material.pbrMetallicRoughness?.setRoughnessFactor(0.7);
	}
}

export default function SidequestsCanvas({
	children,
	ariaLabel = "Sidequests draggable canvas",
}: SidequestsCanvasProps) {
	const canvasRef = useRef<HTMLElement | null>(null);
	const stageRef = useRef<HTMLDivElement | null>(null);
	const positionRef = useRef<CanvasPosition>({ x: 0, y: 0 });
	const dragRef = useRef<ActiveDrag | undefined>(undefined);

	const applyPosition = useCallback(() => {
		const canvas = canvasRef.current;
		const stage = stageRef.current;

		if (!canvas || !stage) {
			return;
		}

		const position = positionRef.current;
		const x = `${position.x}px`;
		const y = `${position.y}px`;

		stage.style.setProperty("--sidequests-pan-x", x);
		stage.style.setProperty("--sidequests-pan-y", y);
		canvas.style.setProperty("--sidequests-dot-x", x);
		canvas.style.setProperty("--sidequests-dot-y", y);
	}, []);

	const stopDragging = useCallback((pointerId?: number) => {
		const canvas = canvasRef.current;

		if (!canvas) {
			return;
		}

		if (pointerId !== undefined) {
			try {
				canvas.releasePointerCapture(pointerId);
			} catch {
				// Synthetic pointer events used in tests do not always have a capturable pointer.
			}
		}

		dragRef.current = undefined;
		canvas.classList.remove("is-dragging");
	}, []);

	const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
		if (
			event.button !== 0 ||
			!(event.target instanceof Element) ||
			event.target.closest("[data-sidequests-pan-ignore], a, button")
		) {
			return;
		}

		const canvas = event.currentTarget;
		const position = positionRef.current;

		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: position.x,
			originY: position.y,
		};

		canvas.classList.add("is-dragging");

		try {
			canvas.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events used in tests do not always have a capturable pointer.
		}
	}, []);

	const handlePointerMove = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			const drag = dragRef.current;

			if (!drag || event.pointerId !== drag.pointerId) {
				return;
			}

			positionRef.current = {
				x: drag.originX + event.clientX - drag.startX,
				y: drag.originY + event.clientY - drag.startY,
			};
			applyPosition();
		},
		[applyPosition],
	);

	const handlePointerUp = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			if (dragRef.current?.pointerId !== event.pointerId) {
				return;
			}

			stopDragging(event.pointerId);
		},
		[stopDragging],
	);

	useEffect(() => {
		applyPosition();
	}, [applyPosition]);

	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas) {
			return;
		}

		const cadModelViewers = Array.from(
			canvas.querySelectorAll<CADModelViewerElement>("[data-cad-model]"),
		);

		if (cadModelViewers.length === 0) {
			return;
		}

		let isDisposed = false;
		let hasRequestedViewer = false;
		let observer: IntersectionObserver | undefined;

		const handleModelLoad = (event: Event) => {
			applyCADMaterial(event.currentTarget as CADModelViewerElement);
		};

		const loadViewer = async () => {
			if (hasRequestedViewer) {
				return;
			}

			hasRequestedViewer = true;
			await import("@google/model-viewer");

			if (isDisposed) {
				return;
			}

			for (const viewer of cadModelViewers) {
				applyCADMaterial(viewer);
			}
		};

		for (const viewer of cadModelViewers) {
			viewer.addEventListener("load", handleModelLoad);
		}

		if ("IntersectionObserver" in window) {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						observer?.disconnect();
						void loadViewer();
					}
				},
				{ rootMargin: "200px" },
			);

			for (const viewer of cadModelViewers) {
				observer.observe(viewer);
			}
		} else {
			void loadViewer();
		}

		return () => {
			isDisposed = true;
			observer?.disconnect();

			for (const viewer of cadModelViewers) {
				viewer.removeEventListener("load", handleModelLoad);
			}
		};
	}, []);

	return (
		<section
			ref={canvasRef}
			className="sidequests-canvas"
			aria-label={ariaLabel}
			data-sidequests-canvas=""
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<div ref={stageRef} className="sidequests-canvas__stage" data-sidequests-stage="">
				{children}
			</div>

			<style>{`
				.sidequests-body {
					overflow: hidden;
				}

				.sidequests-navbar {
					position: fixed;
					top: 1rem;
					left: 50%;
					z-index: 40;
					width: min(calc(100% - 2rem), 39.25rem);
					max-width: calc(100% - 2rem);
					margin-bottom: 0;
					transform: translateX(-50%);
				}

				.sidequests-page {
					position: relative;
					display: block;
					height: 100dvh;
					min-height: 100dvh;
					overflow: hidden;
					background: var(--color-beige);
				}

				.sidequests-canvas {
					--sidequests-dot-x: 0px;
					--sidequests-dot-y: 0px;
					position: absolute;
					inset: 0;
					overflow: hidden;
					background-image: radial-gradient(circle, rgba(42, 35, 29, 0.22) 1px, transparent 1px);
					background-position:
						calc(50% + var(--sidequests-dot-x)) calc(50% + var(--sidequests-dot-y));
					background-size: 1.5rem 1.5rem;
					cursor: grab;
					touch-action: none;
					user-select: none;
				}

				.sidequests-canvas.is-dragging {
					cursor: grabbing;
				}

				.sidequests-canvas__stage {
					--sidequests-pan-x: 0px;
					--sidequests-pan-y: 0px;
					position: absolute;
					top: 50%;
					left: 50%;
					width: clamp(72rem, 128vw, 96rem);
					height: clamp(48rem, 112dvh, 62rem);
					transform: translate3d(
						calc(-50% + var(--sidequests-pan-x)),
						calc(-50% + var(--sidequests-pan-y)),
						0
					);
					will-change: transform;
				}

				.sidequests-canvas__stage > astro-slot {
					display: contents;
				}

				@media (max-width: 48rem) {
					.sidequests-canvas__stage {
						width: 72rem;
						height: 64rem;
					}
				}
			`}</style>
		</section>
	);
}
