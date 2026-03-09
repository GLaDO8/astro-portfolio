import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

const descriptions = [
  "a designer, mushroom grower and a cat dad.",
  "a tinkerer, home cook and a vinyl collector.",
  "a builder, plant parent and a chai snob.",
  "a photographer, trail runner and a type nerd.",
  "a reader, synth enthusiast and a map lover.",
];

export default function HeroSection() {
  const [index, setIndex] = useState(0);
  const directionRef = useRef(1);

  const cycle = () => {
    directionRef.current = 1;
    setIndex((prev) => (prev + 1) % descriptions.length);
  };

  return (
    <section className="w-full flex flex-col items-start gap-6">
      <h1 className="font-kyoto text-[clamp(32px,5vw,48px)] leading-[1.2] text-text-hero m-0">
        <span className="font-[800]">Shreyas</span>{" "}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            className="font-[500] italic inline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            is {descriptions[index]}
          </motion.span>
        </AnimatePresence>
      </h1>

      <div className="flex gap-6 items-center">
        <button
          type="button"
          onClick={cycle}
          className="bg-white rounded-full px-6 py-2 font-inter font-semibold text-xl tracking-[-0.02em] text-text-secondary shadow-[0px_0px_8px_0px_rgba(88,104,110,0.15)] cursor-pointer hover:shadow-[0px_0px_12px_0px_rgba(88,104,110,0.25)] transition-shadow"
        >
          What else?
        </button>

        <a
          href="https://github.com/GLaDO8"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-hero hover:text-text-secondary transition-colors"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="GitHub"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
          </svg>
        </a>

        <a
          href="https://x.com/wutamelonshrey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-hero hover:text-text-secondary transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-label="X"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </div>
    </section>
  );
}
