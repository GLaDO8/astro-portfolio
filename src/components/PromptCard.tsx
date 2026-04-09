import { useState } from "react";

const prompt =
  "Hi Shreyas. I found your site and wanted to talk about your design work, photography, writing, and the experiments you're currently obsessed with.";

export default function PromptCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-charcoal">
      <div className="flex items-center justify-between gap-4 rounded-full bg-[#EAEBE8] pr-1 py-1 pl-5">
        <p className="font-sans text-sm font-medium tracking-[-0.02em] text-charcoal">
          Would you rather chat with me?
        </p>

        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-full bg-white px-4 py-1.5 font-sans text-sm font-medium tracking-[-0.02em] text-charcoal shadow-[0_1px_2px_rgba(42,35,29,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] transition-[box-shadow,transform] hover:shadow-[0_2px_10px_rgba(42,35,29,0.1),inset_0_1px_0_rgba(255,255,255,0.72)] active:scale-[0.98]"
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>

      <p className="pl-5 font-sans text-xs text-slate">
        Paste the prompt in your favourite LLM app.
      </p>
    </div>
  );
}
