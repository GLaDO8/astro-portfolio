import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const POLAROIDS = [
  {
    src: "/snaps/DSCF4135-Enhanced-NR-2.webp",
    rotate: 19,
    tx: 250,
    ty: -40,
    fanRotate: 22,
    fanTx: 260,
    fanTy: -50,
  },
  {
    src: "/snaps/DSCF4283.webp",
    rotate: -5,
    tx: 160,
    ty: 15,
    fanRotate: -8,
    fanTx: 155,
    fanTy: 0,
  },
  {
    src: "/snaps/DSCF4449.webp",
    rotate: 26,
    tx: 250,
    ty: 45,
    fanRotate: 32,
    fanTx: 270,
    fanTy: 38,
  },
] as const;

export default function SnapsWidget() {
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="w-75 h-44 rounded-2xl shrink-0 relative bg-[#bdda7d] overflow-visible cursor-pointer"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* Text content — flexbox column */}
      <div className="flex flex-col h-full p-6">
        <div className="font-sans font-bold text-[30px] leading-9 tracking-[-0.02em] text-[color(display-p3_0.121_0.153_0.016)] pb-4">
          Snaps
        </div>
        <div className="font-sans font-medium text-md tracking-[-0.02em] text-[#607139]">
          Poetry from my camera
        </div>
      </div>
      <AnimatePresence initial={false}>
        {POLAROIDS.map((p, i) => (
          <motion.div
            key={p.rotate}
            className="absolute top-0 left-0 w-24 h-30 bg-white origin-[0%_0%] overflow-hidden shadow-[0px_4px_18px_2px_rgba(93,93,93,0.25),0px_0px_4px_rgba(0,0,0,0.18)]"
            animate={{
              rotate: isHovered ? p.fanRotate : p.rotate,
              x: isHovered ? p.fanTx : p.tx,
              y: isHovered ? p.fanTy : p.ty,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 500,
                    damping: 32,
                    mass: 1,
                    rotate: {
                      type: "spring",
                      stiffness: 500,
                      damping: 32,
                      mass: 1,
                    },
                  }
            }
          >
            <div className="m-[5px] w-[86px] h-[86px] bg-gray-200 overflow-hidden">
              <img
                src={p.src}
                alt={`Snap ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
