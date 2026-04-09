# Shreyas's Personal Website

This personal website will be the home to publish my writings, design case studies, experiments, and other creative work.

## Tech Stack
Astro 6 (static) · React 19 · Tailwind v4 (Vite plugin) · Markdoc · Motion · Biome · TypeScript · Lenis (for smooth scrolling)

## On-Demand Docs
Read the relevant doc BEFORE making changes in that area:

`.claude/docs/widgets.md` — When touching @src/components/WidgetStrip.tsx, any widget component in @src/components/widgets/, or @widget.toml

## Hard Rules
- Simplicity first. Start with the simplest implementation then layer in complexity as needed.
- Paper & Figma MCP if provided, is your source of truth, liberally use it to check for visual parity.
- Create semantic tokens from `@theme` in @src/styles/global.css only when the style is reusable across multiple components.
- Prefer using motion package for animations over complex custom CSS animations.

## CSS & Layout Bug Protocol
When debugging CSS/layout issues, **never edit styles based on source code alone**. The rendered DOM is the source of truth — source files pass through build transforms that may inject, scope, or override styles in ways not visible in source.

1. **Inspect before editing** — Use `agent-browser eval` to run `getComputedStyle()` on the target element and its parent chain for relevant properties. Dump `outerHTML` to see the actual rendered markup and any injected inline styles or wrapper elements.
2. **Identify the winning rule** — Before writing overrides, determine what's currently winning the cascade (inline styles, scoped selectors, utility classes, browser defaults). Know the specificity you're fighting.
3. **Verify after each change** — Re-run `getComputedStyle` to confirm the target property actually changed. Screenshots show *what's wrong*, computed styles show *why*.
