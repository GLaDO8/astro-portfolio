import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import HalftonePhoto from "./widgets/PhotoFrameWidget";
import SnapsWidget from "./widgets/SnapsWidget";

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
			<div className="flex gap-widget-gap items-center w-max px-6">
				<a href="/about" className="no-underline">
					<HalftonePhoto
						src="/halftone-photo.webp"
						alt="Halftone portrait of Shreyas"
					/>
				</a>
				<a href="/snaps" className="no-underline">
					<SnapsWidget />
				</a>
				{children}
			</div>
		</ReactLenis>
	);
}
