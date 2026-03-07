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
			className="overflow-visible"
		>
			<VelocityBridge />
			<div className="flex gap-widget-gap justify-center items-center">
				{children}
			</div>
		</ReactLenis>
	);
}
