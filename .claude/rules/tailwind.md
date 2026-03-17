---
description: Tailwind styling constraints for className usage
globs: ["src/**/*.tsx", "src/**/*.jsx", "src/**/*.astro"]
---

- Conditional/dynamic classNames: always use `cn()` from `@/lib/cn`. Never use template literals for class concatenation.
- Static classNames: plain string is fine, no `cn()` needed.
- No arbitrary one-off values (`pt-[23px]`, `w-[347px]`, `text-[13px]`). Use the Tailwind scale or add a token to `@theme` in `src/styles/global.css`.
- If arbitrary values are dictated by Figma or Paper MCP, use the nearest Tailwind scale value.
- Arbitrary colors (`bg-[#hex]`) are OK temporarily; promote to `@theme` token if reused.
