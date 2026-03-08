import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import MusicWidget from "./widgets/MusicWidget";
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
      <div className="flex gap-8 items-center w-max px-16">
        <MusicWidget />
        <a href="/about" className="no-underline mx-4">
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
