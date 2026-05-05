import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

export type SidequestsMapTransform = {
	translateX: number;
	translateY: number;
	translateZ: number;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
	skewX: number;
	skewY: number;
};

export type SidequestsMapTuning = {
	wholeSvg: SidequestsMapTransform;
	leftPanel: SidequestsMapTransform;
	centerPanel: SidequestsMapTransform;
	rightPanel: SidequestsMapTransform;
};

const mapTransition = {
	type: "spring",
	visualDuration: 0.36,
	bounce: 0.18,
} as const;

const mapVariants = {
	rest: {
		x: "-50%",
		scale: 1,
	},
	hover: {
		x: "-50%",
		scale: 1.015,
	},
};

export const defaultSidequestsMapTuning = {
	wholeSvg: {
		translateX: 0,
		translateY: 0,
		translateZ: 0,
		rotateX: -18,
		rotateY: 0,
		rotateZ: -8,
		skewX: 0,
		skewY: 0,
	},
	leftPanel: {
		translateX: 0,
		translateY: 0,
		translateZ: 0,
		rotateX: 0,
		rotateY: -48,
		rotateZ: 0,
		skewX: 0,
		skewY: 0,
	},
	centerPanel: {
		translateX: 0,
		translateY: 0,
		translateZ: 12,
		rotateX: 0,
		rotateY: 0,
		rotateZ: 0,
		skewX: 0,
		skewY: 0,
	},
	rightPanel: {
		translateX: 0,
		translateY: 0,
		translateZ: 0,
		rotateX: 0,
		rotateY: 48,
		rotateZ: 0,
		skewX: 0,
		skewY: 0,
	},
} satisfies SidequestsMapTuning;

const sceneStyle = {
	alignItems: "center",
	display: "flex",
	height: "100%",
	justifyContent: "center",
	overflow: "visible",
	perspective: "720px",
	transformStyle: "preserve-3d",
	width: "100%",
} satisfies CSSProperties;

const baseMapStyle = {
	display: "flex",
	gap: 0,
	height: "140px",
	position: "relative",
	transformOrigin: "50% 58%",
	transformStyle: "preserve-3d",
	width: "376px",
} satisfies CSSProperties;

const panelBaseStyle = {
	backfaceVisibility: "hidden",
	background: "color-mix(in srgb, var(--color-beige) 90%, white)",
	boxSizing: "border-box",
	flex: "0 0 auto",
	height: "140px",
	overflow: "hidden",
	padding: "9px",
	position: "relative",
} satisfies CSSProperties;

const leftPanelStyle = {
	...panelBaseStyle,
	transformOrigin: "100% 50%",
	width: "106px",
} satisfies CSSProperties;

const centerPanelStyle = {
	...panelBaseStyle,
	marginLeft: "-1px",
	transformOrigin: "50% 50%",
	width: "166px",
} satisfies CSSProperties;

const rightPanelStyle = {
	...panelBaseStyle,
	marginLeft: "-1px",
	transformOrigin: "0% 50%",
	width: "106px",
} satisfies CSSProperties;

const panelInsetStyle = {
	background: "color-mix(in srgb, var(--color-tertiary) 58%, var(--color-beige))",
	height: "100%",
	width: "100%",
} satisfies CSSProperties;

const mapShadowStyle = {
	background: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
	borderRadius: "999px",
	bottom: "-18px",
	filter: "blur(12px)",
	height: "18px",
	left: "22px",
	pointerEvents: "none",
	position: "absolute",
	right: "22px",
	transform: "translateZ(-44px)",
} satisfies CSSProperties;

const leftCreaseShadowStyle = {
	background:
		"linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent)",
	bottom: 0,
	left: 0,
	pointerEvents: "none",
	position: "absolute",
	top: 0,
	width: "10px",
} satisfies CSSProperties;

const rightCreaseShadowStyle = {
	...leftCreaseShadowStyle,
	background:
		"linear-gradient(270deg, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent)",
	left: "auto",
	right: 0,
} satisfies CSSProperties;

function getTransformStyle(transform: SidequestsMapTransform) {
	return [
		`translate3d(${transform.translateX}px, ${transform.translateY}px, ${transform.translateZ}px)`,
		`rotateX(${transform.rotateX}deg)`,
		`rotateY(${transform.rotateY}deg)`,
		`rotateZ(${transform.rotateZ}deg)`,
		`skew(${transform.skewX}deg, ${transform.skewY}deg)`,
	].join(" ");
}

type SidequestsMapWidgetProps = {
	tuning?: SidequestsMapTuning;
};

export default function SidequestsMapWidget({
	tuning = defaultSidequestsMapTuning,
}: SidequestsMapWidgetProps) {
	const shouldReduceMotion = useReducedMotion();

	const mapStyle = {
		...baseMapStyle,
		transform: getTransformStyle(tuning.wholeSvg),
	} satisfies CSSProperties;
	const tunedLeftPanelStyle = {
		...leftPanelStyle,
		transform: getTransformStyle(tuning.leftPanel),
	} satisfies CSSProperties;
	const tunedCenterPanelStyle = {
		...centerPanelStyle,
		transform: getTransformStyle(tuning.centerPanel),
	} satisfies CSSProperties;
	const tunedRightPanelStyle = {
		...rightPanelStyle,
		transform: getTransformStyle(tuning.rightPanel),
	} satisfies CSSProperties;

	return (
		<motion.div
			className="relative h-40 w-80 shrink-0 cursor-pointer [perspective:900px] [transform-style:preserve-3d]"
			initial="rest"
			animate="rest"
			whileHover={shouldReduceMotion ? undefined : "hover"}
			aria-hidden="true"
			data-sidequests-map-widget=""
		>
			<motion.div
				className="absolute left-1/2 top-0 h-40 w-80 overflow-visible [transform-style:preserve-3d]"
				style={{ transformOrigin: "50% 58%", transformStyle: "preserve-3d" }}
				variants={mapVariants}
				transition={shouldReduceMotion ? { duration: 0 } : mapTransition}
				data-sidequests-map-svg=""
			>
				<div style={sceneStyle}>
					<div style={mapStyle} data-sidequests-map-fold="">
						<div style={mapShadowStyle} />
						<div style={tunedLeftPanelStyle} data-sidequests-map-panel="left">
							<div style={panelInsetStyle} />
						</div>
						<div style={tunedCenterPanelStyle} data-sidequests-map-panel="center">
							<div style={panelInsetStyle} />
							<div style={leftCreaseShadowStyle} data-sidequests-map-crease="left" />
							<div style={rightCreaseShadowStyle} data-sidequests-map-crease="right" />
						</div>
						<div style={tunedRightPanelStyle} data-sidequests-map-panel="right">
							<div style={panelInsetStyle} />
						</div>
					</div>
				</div>
			</motion.div>
		</motion.div>
	);
}
