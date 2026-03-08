import { ReactLenis, useLenis } from "lenis/react";
import type { ReactNode } from "react";
import { scrollVelocity } from "@/lib/scroll-velocity";
import HalftonePhoto from "./widgets/HalftonePhoto";
import SnapsWidget from "./widgets/SnapsWidget";

function VelocityBridge() {
	useLenis((lenis) => {
		scrollVelocity.set(lenis.velocity);
	});
	return null;
}

interface WidgetStripProps {
	children?: ReactNode;
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
				<HalftonePhoto
					src="/my-photo-sm.jpg"
					alt="Halftone portrait of Shreyas"
					idPrefix="postit1"
				/>
				<a href="/snaps" className="no-underline">
					<SnapsWidget />
				</a>
				{children}
			</div>
		</ReactLenis>
	);
}
