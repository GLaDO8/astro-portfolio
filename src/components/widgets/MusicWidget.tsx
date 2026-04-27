import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef } from "react";
import type { SongData } from "@/lib/widgetConfig";

const DEG_PER_MS = (33 * 360) / 60000; // 33 RPM in degrees/ms
const VINYL_LABEL_PATH =
  "M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";
const SLEEVE_TEXTURE = "/sleeve.png";
const SLEEVE_MASK_STYLE = {
  WebkitMaskImage: `url(${SLEEVE_TEXTURE})`,
  maskImage: `url(${SLEEVE_TEXTURE})`,
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
};

interface Props {
  songData: SongData;
}

export default function MusicWidget({ songData }: Props) {
  const rotation = useMotionValue(0);
  const isScratching = useRef(false);
  const isVisible = useRef(true);
  const lastAngle = useRef(0);
  const cachedRect = useRef<DOMRect | null>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const albumArt = songData.albumArt || "/vinyl-album-art.svg";
  const idBase = useId().replace(/:/g, "");
  const clipId = `${idBase}-vinyl-label`;
  const stickerFilterId = `${idBase}-sticker-outline`;

  useEffect(() => {
    if (!recordRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.isIntersecting;
    });
    obs.observe(recordRef.current);
    return () => obs.disconnect();
  }, []);

  // Auto-rotate at 33 RPM when not scratching and visible
  useAnimationFrame((_, delta) => {
    if (shouldReduceMotion) return;
    if (!isScratching.current && isVisible.current) {
      rotation.set((rotation.get() + DEG_PER_MS * delta) % 360);
    }
  });

  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    const rect = cachedRect.current;
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (recordRef.current) {
        cachedRect.current = recordRef.current.getBoundingClientRect();
      }
      isScratching.current = true;
      lastAngle.current = getAngleFromCenter(e.clientX, e.clientY);
    },
    [getAngleFromCenter],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isScratching.current) return;
      const angle = getAngleFromCenter(e.clientX, e.clientY);
      let delta = angle - lastAngle.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      rotation.set(rotation.get() + delta);
      lastAngle.current = angle;
    },
    [getAngleFromCenter, rotation],
  );

  const handlePointerUp = useCallback(() => {
    isScratching.current = false;
  }, []);

  return (
    <div>
      {/*SVG filter for applying sticker-like white outline*/}
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0" focusable="false">
        <defs>
          <filter id={stickerFilterId} x="0" y="0" width="100%" height="100%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="expanded" />

            <feFlood flood-color="white" result="white" />

            <feComposite in="white" in2="expanded" operator="in" result="outline" />

            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="2"
              flood-color="rgba(0,0,0,0.25)"
              result="shadow"
            />

            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div
        ref={recordRef}
        className="scale-130 group"
        style={{ filter: `url(#${stickerFilterId})` }}
      >
        <motion.div
          className="absolute left-10 -top-1 group-hover:left-12 size-28 cursor-grab rounded-full active:cursor-grabbing [clip-path:circle(50%)] touch-action-none z-10 transition-[left] duration-150"
          style={{ rotate: rotation }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img src="/record content.png" alt="" className="h-full w-full" draggable={false} />
          <svg
            viewBox="0 0 59 59"
            className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Album art"
          >
            <defs>
              <clipPath id={clipId}>
                <path d={VINYL_LABEL_PATH} />
              </clipPath>
            </defs>
            <image
              href={albumArt}
              x="0"
              y="0"
              width="59"
              height="59"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
          </svg>
        </motion.div>

        <img
          src="/specular highlight.svg"
          alt=""
          className="pointer-events-none absolute top-[11.5px] right-[34px] z-20 w-10 mix-blend-color-dodge"
          draggable={false}
        />

        <div className="absolute left-0 top-1 h-[6.8rem] w-[6.8rem] rotate-[-3deg] [isolation:isolate] drop-shadow-[0_10px_18px_rgba(42,35,29,0.18)] z-30">
          <img
            src={albumArt}
            alt=""
            className="absolute top-1/2 left-1/2 z-0 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-cover"
            style={SLEEVE_MASK_STYLE}
            draggable={false}
          />
          <img
            src={SLEEVE_TEXTURE}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover mix-blend-lighten"
            draggable={false}
          />
          <img
            src={SLEEVE_TEXTURE}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full object-cover mix-blend-exclusion"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
