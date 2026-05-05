import { type DialConfig, DialRoot, type ResolvedValues, useDialKit } from "dialkit";
import "dialkit/styles.css";
import SidequestsMapWidget, {
	defaultSidequestsMapTuning,
	type SidequestsMapTransform,
	type SidequestsMapTuning,
} from "@/components/widgets/SidequestsMapWidget";

type DialAxisValues = {
	x: number;
	y: number;
	z: number;
};

type DialSkewValues = Omit<DialAxisValues, "z">;

type DialTransformValues = {
	translate: DialAxisValues;
	rotate: DialAxisValues;
	skew: DialSkewValues;
};

const translateRange = {
	min: -180,
	max: 180,
	step: 1,
};

const rotateRange = {
	min: -180,
	max: 180,
	step: 1,
};

const skewRange = {
	min: -60,
	max: 60,
	step: 1,
};

function slider(defaultValue: number, min: number, max: number, step: number) {
	return [defaultValue, min, max, step] satisfies [number, number, number, number];
}

function transformControls(defaults: SidequestsMapTransform) {
	return {
		translate: {
			x: slider(defaults.translateX, translateRange.min, translateRange.max, translateRange.step),
			y: slider(defaults.translateY, translateRange.min, translateRange.max, translateRange.step),
			z: slider(defaults.translateZ, translateRange.min, translateRange.max, translateRange.step),
		},
		rotate: {
			x: slider(defaults.rotateX, rotateRange.min, rotateRange.max, rotateRange.step),
			y: slider(defaults.rotateY, rotateRange.min, rotateRange.max, rotateRange.step),
			z: slider(defaults.rotateZ, rotateRange.min, rotateRange.max, rotateRange.step),
		},
		skew: {
			x: slider(defaults.skewX, skewRange.min, skewRange.max, skewRange.step),
			y: slider(defaults.skewY, skewRange.min, skewRange.max, skewRange.step),
		},
	};
}

const sidequestsMapDialkitConfig = {
	wholeSvg: transformControls(defaultSidequestsMapTuning.wholeSvg),
	leftPanel: transformControls(defaultSidequestsMapTuning.leftPanel),
	centerPanel: transformControls(defaultSidequestsMapTuning.centerPanel),
	rightPanel: transformControls(defaultSidequestsMapTuning.rightPanel),
} satisfies DialConfig;

type SidequestsMapDialkitValues = ResolvedValues<typeof sidequestsMapDialkitConfig>;

function resolveTransform(values: DialTransformValues): SidequestsMapTransform {
	return {
		translateX: values.translate.x,
		translateY: values.translate.y,
		translateZ: values.translate.z,
		rotateX: values.rotate.x,
		rotateY: values.rotate.y,
		rotateZ: values.rotate.z,
		skewX: values.skew.x,
		skewY: values.skew.y,
	};
}

export default function SidequestsMapDialkitWidget() {
	const values: SidequestsMapDialkitValues = useDialKit(
		"Sidequests map",
		sidequestsMapDialkitConfig,
	);
	const tuning: SidequestsMapTuning = {
		wholeSvg: resolveTransform(values.wholeSvg),
		leftPanel: resolveTransform(values.leftPanel),
		centerPanel: resolveTransform(values.centerPanel),
		rightPanel: resolveTransform(values.rightPanel),
	};

	return (
		<>
			<SidequestsMapWidget tuning={tuning} />
			<DialRoot position="top-right" />
		</>
	);
}
