import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EditableItem = {
	id: string;
	label: string;
	element: HTMLElement;
	rect: DOMRect;
	topRem: number;
	leftRem: number;
	className: string;
};

type DragState = {
	id: string;
	startX: number;
	startY: number;
	startTopRem: number;
	startLeftRem: number;
	scale: number;
};

const rootFontSize = () =>
	Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

const roundRem = (value: number) => Math.round(value * 100) / 100;

const remToken = (value: number) => {
	const rounded = roundRem(value);
	return Number.isInteger(rounded) ? `${rounded}rem` : `${rounded.toFixed(2)}rem`;
};

const positionClass = (axis: "top" | "left", rem: number) => `${axis}-[${remToken(rem)}]`;

const removePositionClasses = (className: string) =>
	className
		.split(/\s+/)
		.filter((token) => token && !/^(?:[a-z]+:)?(?:top|left)-/.test(token))
		.join(" ");

const getStageScale = () => {
	const stage = document.querySelector<HTMLElement>("[data-sidequests-stage]");
	const rawScale = stage ? getComputedStyle(stage).getPropertyValue("--sidequests-scale") : "1";
	const scale = Number.parseFloat(rawScale);

	return Number.isFinite(scale) && scale > 0 ? scale : 1;
};

const getItemPosition = (element: HTMLElement) => {
	const fontSize = rootFontSize();
	const top = roundRem(element.offsetTop / fontSize);
	const left = roundRem(element.offsetLeft / fontSize);

	return { top, left };
};

const setItemPosition = (element: HTMLElement, topRem: number, leftRem: number) => {
	const baseClassName = removePositionClasses(element.className);
	const nextClassName = [
		"absolute",
		positionClass("top", topRem),
		positionClass("left", leftRem),
		baseClassName.replace(/\babsolute\b/g, "").trim(),
	]
		.filter(Boolean)
		.join(" ");

	element.className = nextClassName;
	element.style.top = remToken(topRem);
	element.style.left = remToken(leftRem);
};

const readItems = (): EditableItem[] =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-sidequest-item]")).map((element) => {
		const { top, left } = getItemPosition(element);

		return {
			id: element.dataset.sidequestItem || "untitled",
			label: element.dataset.sidequestLabel || element.dataset.sidequestItem || "Untitled",
			element,
			rect: element.getBoundingClientRect(),
			topRem: top,
			leftRem: left,
			className: element.className,
		};
	});

export default function SidequestsPositioner() {
	const [enabled, setEnabled] = useState(false);
	const [items, setItems] = useState<EditableItem[]>([]);
	const [selectedId, setSelectedId] = useState<string | undefined>();
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const dragRef = useRef<DragState | undefined>(undefined);

	const selectedItem = useMemo(
		() => items.find((item) => item.id === selectedId) ?? items[0],
		[items, selectedId],
	);

	const refresh = useCallback(() => {
		const nextItems = readItems();
		setItems(nextItems);
		setSaveStatus("idle");
		setSelectedId((current) => {
			if (current && nextItems.some((item) => item.id === current)) {
				return current;
			}

			return nextItems[0]?.id;
		});
	}, []);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		refresh();
		window.addEventListener("resize", refresh);
		document.addEventListener("astro:page-load", refresh);

		return () => {
			window.removeEventListener("resize", refresh);
			document.removeEventListener("astro:page-load", refresh);
		};
	}, [enabled, refresh]);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			const item = selectedItem;

			if (!item || event.target instanceof HTMLInputElement) {
				return;
			}

			const direction = {
				ArrowUp: [0, -1],
				ArrowRight: [1, 0],
				ArrowDown: [0, 1],
				ArrowLeft: [-1, 0],
			}[event.key] as [number, number] | undefined;

			if (!direction) {
				return;
			}

			event.preventDefault();

			const step = event.shiftKey ? 1 : 0.25;
			const [x, y] = direction;
			setItemPosition(item.element, item.topRem + y * step, item.leftRem + x * step);
			refresh();
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [enabled, refresh, selectedItem]);

	const startDrag = (event: React.PointerEvent, item: EditableItem) => {
		event.preventDefault();
		event.stopPropagation();
		setSelectedId(item.id);

		dragRef.current = {
			id: item.id,
			startX: event.clientX,
			startY: event.clientY,
			startTopRem: item.topRem,
			startLeftRem: item.leftRem,
			scale: getStageScale(),
		};

		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const drag = (event: React.PointerEvent) => {
		const activeDrag = dragRef.current;

		if (!activeDrag) {
			return;
		}

		const item = items.find((candidate) => candidate.id === activeDrag.id);

		if (!item) {
			return;
		}

		const fontSize = rootFontSize();
		const deltaX = (event.clientX - activeDrag.startX) / activeDrag.scale / fontSize;
		const deltaY = (event.clientY - activeDrag.startY) / activeDrag.scale / fontSize;

		setItemPosition(
			item.element,
			roundRem(activeDrag.startTopRem + deltaY),
			roundRem(activeDrag.startLeftRem + deltaX),
		);
		refresh();
	};

	const stopDrag = () => {
		dragRef.current = undefined;
	};

	const savePositions = async () => {
		const nextItems = readItems();

		setItems(nextItems);
		setSaveStatus("saving");

		const response = await fetch("/__dev/sidequests-positioner", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				items: nextItems.map((item) => ({
					id: item.id,
					className: item.className,
				})),
			}),
		});

		if (!response.ok) {
			setSaveStatus("error");
			return;
		}

		setSaveStatus("saved");
		setEnabled(false);
	};

	if (!window.location.pathname.startsWith("/sidequests")) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[9998] pointer-events-none font-sans">
			<button
				type="button"
				className="pointer-events-auto fixed right-3 bottom-3 rounded-md border border-primary/20 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-[0_10px_30px_rgba(42,35,29,0.14)]"
				onClick={() => setEnabled((value) => !value)}
				data-sidequests-pan-ignore=""
			>
				{enabled ? "Hide positioner" : "Position sidequests"}
			</button>

			{enabled && (
				<>
					<div className="pointer-events-auto fixed top-3 right-3 w-80 rounded-md border border-primary/15 bg-white/95 p-3 text-primary shadow-[0_18px_50px_rgba(42,35,29,0.16)] backdrop-blur">
						<div className="mb-3 flex items-center justify-between gap-2">
							<p className="text-sm font-bold">Sidequests positioner</p>
							<button
								type="button"
								className="rounded border border-primary/15 px-2 py-1 text-xs font-semibold"
								onClick={refresh}
								data-sidequests-pan-ignore=""
							>
								Refresh
							</button>
						</div>

						{selectedItem && (
							<p className="rounded border border-primary/10 bg-primary/5 px-2 py-1.5 text-sm font-semibold">
								{selectedItem.label}: top {selectedItem.topRem}rem, left {selectedItem.leftRem}rem
							</p>
						)}

						<button
							type="button"
							className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
							onClick={savePositions}
							disabled={items.length === 0 || saveStatus === "saving"}
							data-sidequests-pan-ignore=""
						>
							{saveStatus === "saving" ? "Saving" : "Done"}
						</button>

						<p className="mt-2 text-xs leading-relaxed text-secondary">
							Drag an object to move it. Arrow keys nudge the selected object; Shift nudges farther.
							Done writes the positions into sidequests.astro.
						</p>
						{saveStatus === "error" && (
							<p className="mt-2 text-xs font-semibold text-red-700">Could not save positions.</p>
						)}
					</div>

					{items.map((item) => (
						<button
							key={item.id}
							type="button"
							className={[
								"pointer-events-auto fixed cursor-move border-2 bg-primary/5 text-left",
								item.id === selectedItem?.id ? "border-primary" : "border-primary/35",
							].join(" ")}
							style={{
								top: item.rect.top,
								left: item.rect.left,
								width: item.rect.width,
								height: item.rect.height,
							}}
							onPointerDown={(event) => startDrag(event, item)}
							onPointerMove={drag}
							onPointerUp={stopDrag}
							onPointerCancel={stopDrag}
							data-sidequests-pan-ignore=""
							aria-label={`Move ${item.label}`}
						>
							<span className="absolute -top-6 left-0 rounded bg-primary px-2 py-1 text-xs font-semibold text-white">
								{item.label}
							</span>
						</button>
					))}
				</>
			)}
		</div>
	);
}
