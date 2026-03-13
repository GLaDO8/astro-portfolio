import { motion, useReducedMotion } from "motion/react";

interface Props {
  src: string;
  alt?: string;
}

export default function PhotoFrameWidget({ src, alt = "Photo" }: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="w-75 h-50 shrink-0 relative"
      whileHover={shouldReduceMotion ? undefined : { rotate: -4 }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
    >
      <img
        src={src}
        alt={alt}
        className="block w-full h-full -rotate-2 border-5 border-white bg-halftone-base object-cover shadow-lg rounded-sm"
      />
      <div className="absolute left-54 top-32">
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
