import { ReactLenis, useLenis } from "lenis/react";
import type { ReactNode } from "react";
import { scrollVelocity } from "@/lib/scroll-velocity";

function VelocityBridge() {
	useLenis((lenis) => {
		scrollVelocity.set(lenis.velocity);
	});
	return null;
}

interface WidgetStripProps {
	children: ReactNode;
}

export default function WidgetStrip({ children }: WidgetStripProps) {
	return (
		<ReactLenis
			options={{
				orientation: "horizontal",
				gestureOrientation: "both",
			}}
			className="overflow-x-auto overflow-y-visible scrollbar-hide py-16"
		>
			<VelocityBridge />
			<div className="flex gap-widget-gap items-center w-max px-6">
				{children}
			</div>
		</ReactLenis>
	);
}
