import { motion, useMotionValue, useSpring } from "motion/react";
import { useSpringConfig } from "@/lib/spring-config";

interface Props {
  src: string;
  alt?: string;
}

export default function HalftonePhoto({ src, alt = "Photo" }: Props) {
  const frameConfig = useSpringConfig("photoFrameTilt");
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springX = useSpring(rotateX, frameConfig);
  const springY = useSpring(rotateY, frameConfig);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    rotateY.set(((e.clientX - centerX) / (rect.width / 2)) * 4);
    rotateX.set(((e.clientY - centerY) / (rect.height / 2)) * -4);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      className="w-[300px] h-[200px] shrink-0 relative"
      style={{
        rotateX: springX,
        rotateY: springY,
        transformPerspective: 800,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <img
        src={src}
        alt={alt}
        className="block w-full h-full -rotate-2 border-5 border-white bg-halftone-base object-cover shadow-lg rounded-[4px]"
      />
      <div className="absolute left-[216px] top-[127px]">
        <img
          src="/postit-me.svg"
          alt="Post-it note saying Me!"
          width={97}
          height={105}
        />
      </div>
    </motion.div>
  );
}
