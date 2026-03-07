import { motionValue } from "motion/react";

/**
 * Module-level MotionValue for scroll velocity.
 * Updated per-frame by WidgetStrip's Lenis instance.
 * Read by any widget via scrollVelocity.get() inside animation frames,
 * or via useMotionValueEvent(scrollVelocity, 'change', cb).
 */
export const scrollVelocity = motionValue(0);
