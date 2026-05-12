import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef } from "react";

import { hideCADModelViewerScrollbars } from "@/components/sidequests/CADRender";
import { cn } from "@/lib/cn";

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

const canvasClassName = cn(
	"[--sidequests-dot-x:0px] [--sidequests-dot-y:0px]",
	"absolute inset-0 overflow-hidden select-none touch-none cursor-grab",
	"[background-image:radial-gradient(circle,rgba(42,35,29,0.22)_1px,transparent_1px)]",
	"[background-position:calc(50%_+_var(--sidequests-dot-x))_calc(50%_+_var(--sidequests-dot-y))]",
	"[background-size:1.5rem_1.5rem]",
	"[&.is-dragging]:cursor-grabbing",
);

const stageClassName = cn(
	"[--sidequests-pan-x:0px] [--sidequests-pan-y:0px] [--sidequests-scale:0.76]",
	"absolute top-1/2 left-1/2 h-[64rem] w-[72rem] will-change-transform",
	"[transform:translate3d(calc(-50%_+_var(--sidequests-pan-x)),calc(-50%_+_var(--sidequests-pan-y)),0)_scale(var(--sidequests-scale))]",
	"[&>astro-slot]:contents",
	"sm:[--sidequests-scale:0.84] md:h-[clamp(48rem,112dvh,62rem)] md:w-[clamp(72rem,128vw,96rem)] md:[--sidequests-scale:1]",
);

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
			const viewer = event.currentTarget as CADModelViewerElement;

			hideCADModelViewerScrollbars(viewer);
			applyCADMaterial(viewer);
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
				hideCADModelViewerScrollbars(viewer);
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
			className={canvasClassName}
			aria-label={ariaLabel}
			data-sidequests-canvas=""
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<div ref={stageRef} className={stageClassName} data-sidequests-stage="">
				{children}
			</div>
		</section>
	);
}
