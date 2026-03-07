/**
 * Global mouse velocity tracker.
 * Tracks pointer movement, smooths via exponential moving average,
 * and exposes normalized velocity vector for widget consumption.
 */

interface MouseState {
	x: number;
	y: number;
	vx: number;
	vy: number;
	speed: number;
}

const state: MouseState = { x: 0, y: 0, vx: 0, vy: 0, speed: 0 };
const SMOOTHING = 0.15;
let lastTime = 0;
let initialized = false;

function onPointerMove(e: PointerEvent) {
	const now = performance.now();
	const dt = now - lastTime;
	if (dt === 0 || lastTime === 0) {
		lastTime = now;
		state.x = e.clientX;
		state.y = e.clientY;
		return;
	}

	const rawVx = (e.clientX - state.x) / dt;
	const rawVy = (e.clientY - state.y) / dt;

	state.vx += (rawVx - state.vx) * SMOOTHING;
	state.vy += (rawVy - state.vy) * SMOOTHING;
	state.speed = Math.hypot(state.vx, state.vy);
	state.x = e.clientX;
	state.y = e.clientY;
	lastTime = now;
}

export function initMouseTracker() {
	if (initialized) return;
	window.addEventListener("pointermove", onPointerMove, { passive: true });
	initialized = true;
}

export function getMouseState(): Readonly<MouseState> {
	return state;
}
