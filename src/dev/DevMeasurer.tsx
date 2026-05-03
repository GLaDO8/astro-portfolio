import { Measurer } from "mesurer";

export default function DevMeasurer() {
	return (
		<Measurer
			highlightColor="oklch(0.56 0.17 250)"
			guideColor="oklch(0.7 0.15 38)"
			persistOnReload
		/>
	);
}
