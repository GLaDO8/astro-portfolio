import { cancelFrame, frame, springValue, styleEffect } from "motion";

const PROXIMITY_RANGE = 280;
const MAX_ROTATION = 12;
const CENTER_EASING_DISTANCE = 120;
const ROTATION_SPRING = { stiffness: 500, damping: 20, mass: 0.7 };

type Point = { x: number; y: number };
type Bounds = { left: number; right: number; top: number; bottom: number };

export function proximityStrength(pointer: Point, bounds: Bounds) {
	const dx = Math.max(bounds.left - pointer.x, 0, pointer.x - bounds.right);
	const dy = Math.max(bounds.top - pointer.y, 0, pointer.y - bounds.bottom);
	const t = Math.max(0, 1 - Math.hypot(dx, dy) / PROXIMITY_RANGE);
	return t * t * (3 - 2 * t);
}

export function widgetRotation(pointer: Point, center: Point, strength: number) {
	const dx = pointer.x - center.x;
	const dy = pointer.y - center.y;
	// Use the unsigned vertical distance so the rotation direction stays consistent
	// above and below the card: cursor right = counterclockwise, cursor left = clockwise.
	const angleFromVertical = Math.atan2(-dx, Math.abs(dy));
	// The angle is undefined at the center; fade there to avoid a sudden direction flip.
	const centerEase = Math.min(1, Math.hypot(dx, dy) / CENTER_EASING_DISTANCE);
	return (angleFromVertical / (Math.PI / 2)) * MAX_ROTATION * centerEase * strength;
}

export function setupWidgetProximity(strip: HTMLElement) {
	const media = window.matchMedia(
		"(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
	);
	const controller = new AbortController();
	const { signal } = controller;
	const widgets = Array.from(strip.querySelectorAll<HTMLElement>("[data-home-widget-tilt]")).map(
		(element) => {
			const anchor = element.parentElement as HTMLElement;
			const rotation = springValue(0, ROTATION_SPRING);
			const cancelStyle = styleEffect(element, { rotate: rotation });
			return { element, anchor, rotation, cancelStyle, target: 0 };
		},
	);
	let pointer: Point | undefined;
	let visible = false;

	const reset = (immediate = false) => {
		pointer = undefined;
		cancelFrame(update);
		for (const widget of widgets) {
			widget.target = 0;
			if (immediate) widget.rotation.jump(0);
			else widget.rotation.set(0);
		}
	};

	function update() {
		if (!pointer || !visible || !media.matches || document.hidden) return;

		// Measure the stationary outer layer, never the animated layer (which would feed back).
		// All reads happen together; styleEffect batches spring writes in Motion's render step.
		const measured = widgets.map((widget) => ({
			widget,
			rect: widget.anchor.getBoundingClientRect(),
		}));
		const onscreen = measured.filter(
			({ rect }) =>
				rect.width > 0 &&
				rect.height > 0 &&
				rect.right > 0 &&
				rect.left < window.innerWidth &&
				rect.bottom > 0 &&
				rect.top < window.innerHeight,
		);
		if (!onscreen.length) {
			reset();
			return;
		}
		const bounds = {
			left: Math.max(0, Math.min(...onscreen.map(({ rect }) => rect.left))),
			right: Math.min(window.innerWidth, Math.max(...onscreen.map(({ rect }) => rect.right))),
			top: Math.max(0, Math.min(...onscreen.map(({ rect }) => rect.top))),
			bottom: Math.min(window.innerHeight, Math.max(...onscreen.map(({ rect }) => rect.bottom))),
		};
		const strength = proximityStrength(pointer, bounds);
		for (const { widget, rect } of measured) {
			const rotation =
				rect.width && rect.height
					? widgetRotation(
							pointer,
							{ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
							strength,
						)
					: 0;
			if (rotation !== widget.target) widget.rotation.set(rotation);
			widget.target = rotation;
		}
		// On narrow mouse-driven windows the marquee moves even with a stationary cursor.
		// Desktop tracking otherwise sleeps between pointer/scroll/resize events.
		if (strength > 0 && window.innerWidth < 768) frame.read(update);
	}

	const scheduleUpdate = () => {
		if (pointer && visible && media.matches) frame.read(update);
	};
	const observer = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (!visible) reset();
		else scheduleUpdate();
	});
	observer.observe(strip);

	window.addEventListener(
		"pointermove",
		(event) => {
			if (event.pointerType !== "mouse") {
				reset();
				return;
			}
			if (!media.matches || !visible) return;
			pointer = { x: event.clientX, y: event.clientY };
			scheduleUpdate();
		},
		{ passive: true, signal },
	);
	window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true, signal });
	window.addEventListener("resize", scheduleUpdate, { passive: true, signal });
	window.addEventListener("blur", () => reset(), { signal });
	document.documentElement.addEventListener("pointerleave", () => reset(), { signal });
	document.addEventListener(
		"visibilitychange",
		() => {
			if (document.hidden) reset(true);
		},
		{ signal },
	);
	media.addEventListener("change", () => reset(true), { signal });
	const resizeObserver = new ResizeObserver(scheduleUpdate);
	for (const { anchor } of widgets) resizeObserver.observe(anchor);

	return () => {
		controller.abort();
		observer.disconnect();
		resizeObserver.disconnect();
		reset(true);
		for (const widget of widgets) {
			widget.cancelStyle();
			widget.rotation.destroy();
			widget.element.style.removeProperty("transform");
		}
	};
}
