import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { useCallback, useRef } from "react";
import type { SongData } from "@/lib/music";

const DEG_PER_MS = (33 * 360) / 60000; // 33 RPM in degrees/ms

const VINYL_LABEL_PATH =
  "M27.7924 0.0401388C43.9614 -0.801682 57.7516 11.6235 58.5934 27.7926C59.4353 43.9616 47.0101 57.7518 30.841 58.5936C14.6719 59.4355 0.881799 47.0103 0.0399393 30.8412C-0.801915 14.6721 11.6233 0.881993 27.7924 0.0401388ZM29.0468 24.1325C26.1835 24.2816 23.9832 26.7235 24.1323 29.5868C24.2814 32.4501 26.7233 34.6504 29.5866 34.5013C32.4499 34.3522 34.6501 31.9102 34.5011 29.047C34.352 26.1837 31.91 23.9835 29.0468 24.1325Z";

interface Props {
  songData: SongData;
}

export default function MusicWidget({ songData }: Props) {
  const rotation = useMotionValue(0);
  const isScratching = useRef(false);
  const lastAngle = useRef(0);
  const recordRef = useRef<HTMLDivElement>(null);

  // Auto-rotate at 33 RPM when not scratching
  useAnimationFrame((_, delta) => {
    if (!isScratching.current) {
      rotation.set(rotation.get() + DEG_PER_MS * delta);
    }
  });

  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!recordRef.current) return 0;
    const rect = recordRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
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
    <div className="w-[300px] h-[200px] shrink-0 relative">
      {/* White card background */}
      <div className="absolute inset-0 bg-white rounded-2xl shadow-lg" />

      {/* iOS chat bubble — anchored top-left */}
      {songData.message && (
        <div className="absolute left-[-100px] top-[-20px] z-30">
          <div className="chat-bubble-tail relative bg-[#0b93f6] text-white font-inter text-[13px] leading-[18px] rounded-[20px] px-4 py-2 max-w-[200px]">
            {songData.message}
          </div>
        </div>
      )}

      {/* Song info text */}
      <div className="absolute left-0 bottom-0 flex flex-col pl-6 pb-6">
        <span className="font-inter font-bold text-[12px] text-green-label tracking-[-0.3px] uppercase">
          {songData.label}
        </span>
        <span className="font-inter font-bold text-[30px] tracking-[-0.6px] text-black leading-none">
          {songData.artist}
        </span>
        <span className="font-inter font-medium text-[24px] tracking-[-0.48px] text-black leading-none">
          {songData.title}
        </span>
      </div>

      {/* Record player assembly */}
      <div
        ref={recordRef}
        className="absolute left-[140px] top-[-65px] w-[220px] h-[220px]"
      >
        {/* Spinning/scratchable record + album art */}
        <motion.div
          className="relative w-full h-full cursor-grab active:cursor-grabbing"
          style={{ rotate: rotation }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            src="/record content.png"
            alt=""
            className="w-full h-full"
            draggable={false}
          />
          {/* Album art — inline SVG with donut clip */}
          <svg
            viewBox="0 0 59 59"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[82px] h-[82px]"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Album art"
          >
            <defs>
              <clipPath id="vinyl-label-clip">
                <path d={VINYL_LABEL_PATH} />
              </clipPath>
            </defs>
            <image
              href={songData.albumArt}
              x="0"
              y="0"
              width="59"
              height="59"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#vinyl-label-clip)"
            />
          </svg>
        </motion.div>

        {/* Specular highlight — static overlay */}
        <img
          src="/specular highlight.svg"
          alt=""
          className="absolute left-[35px] top-[31px] w-[80px] mix-blend-color-dodge pointer-events-none"
          draggable={false}
        />

        {/* Tonearm — static */}
        <img
          src="/tonearm.png"
          alt=""
          className="absolute left-[-44px] top-[45px] w-[130px] -rotate-[4deg] origin-[30%_15%] pointer-events-none z-10"
          draggable={false}
        />
      </div>
    </div>
  );
}
