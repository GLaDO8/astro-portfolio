import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import type { SongData } from "@/lib/music";
import MusicWidget from "./widgets/MusicWidget";
import PhotoFrameWidget from "./widgets/PhotoFrameWidget";
import SnapsWidget from "./widgets/SnapsWidget";

interface Props {
	songData: SongData;
	children?: ReactNode;
}

export default function WidgetStrip({ songData, children }: Props) {
	return (
		<ReactLenis
			options={{
				orientation: "horizontal",
				gestureOrientation: "both",
			}}
			className="overflow-x-auto overflow-y-visible scrollbar-hide py-12"
		>
			<div className="flex gap-6 items-center w-max pr-16 pl-32">
				<MusicWidget songData={songData} />
				<a href="/about" className="no-underline mx-5">
					<PhotoFrameWidget src="/halftone-photo.webp" alt="Halftone portrait of Shreyas" />
				</a>
				<a href="/snaps" className="no-underline">
					<SnapsWidget />
				</a>

				{children}
			</div>
		</ReactLenis>
	);
}
