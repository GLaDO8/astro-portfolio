import { useSyncExternalStore } from "react";

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass: number;
}

export interface SpringConfigMap {
	postItTilt: SpringConfig;
	postItLift: SpringConfig;
	photoFrameTilt: SpringConfig;
	polaroidFan: SpringConfig;
}

const defaults: SpringConfigMap = {
	postItTilt: { stiffness: 100, damping: 10, mass: 1 },
	postItLift: { stiffness: 150, damping: 15, mass: 1 },
	photoFrameTilt: { stiffness: 120, damping: 18, mass: 1 },
	polaroidFan: { stiffness: 180, damping: 12, mass: 1 },
};

// Deep clone defaults so mutations don't affect the template
let configs: SpringConfigMap = JSON.parse(JSON.stringify(defaults));
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

export function getSpringConfig<K extends keyof SpringConfigMap>(
	key: K,
): SpringConfigMap[K] {
	return configs[key];
}

export function updateSpringConfig<K extends keyof SpringConfigMap>(
	key: K,
	partial: Partial<SpringConfig>,
) {
	configs[key] = { ...configs[key], ...partial };
	emit();
}

export function resetSpringConfigs() {
	configs = JSON.parse(JSON.stringify(defaults));
	emit();
}

export function getAllSpringConfigs(): SpringConfigMap {
	return configs;
}

export function getSpringConfigDefaults(): SpringConfigMap {
	return defaults;
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

// React hook — triggers re-render when any config changes
// Third arg = getServerSnapshot (required for SSR in Astro's client:visible)
export function useSpringConfig<K extends keyof SpringConfigMap>(
	key: K,
): SpringConfigMap[K] {
	return useSyncExternalStore(
		subscribe,
		() => configs[key],
		() => defaults[key],
	);
}

// React hook — returns all configs, re-renders on any change
export function useAllSpringConfigs(): SpringConfigMap {
	return useSyncExternalStore(
		subscribe,
		() => configs,
		() => defaults,
	);
}
