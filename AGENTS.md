# Shreyas's Personal Website

## Stack
- **Astro** — Static shell, View Transitions, Markdoc for blog content
- **React islands** — Interactive widgets and components (hydrated on demand)
- **Motion** (formerly Framer Motion) — Spring animation, drag gestures, MotionValues bypass React renders
- **Lenis** — Smooth horizontal scroll for widget strip (exposes velocity per frame)
- **Tailwind V4** — `@tailwindcss/vite` plugin, `@theme` for tokens, ALL styles via utility classes
- **Markdoc** — Blog content with custom tags (file-based CMS, Obsidian-compatible later)
- **Cloudflare Pages** — Deployment

## Hard Rules
- **Strictly Tailwind v4 utility classes** — no inline styles, no `<style>` blocks, no CSS modules
- Paper MCP is our source of truth, liberally use it to check for visual parity. 
- Use Codex chrome MCP aggressively to test your localhost implementation. Keep iterating till bugs & issues are solved.
- When working with frameworks, libraries and packages, always use context7 MCP to refer the latest documentation. 

## Memory System
Long-term memory lives in the Codex memory directory, NOT in this repo.
See `/Users/shreyasgupta/.Codex/projects/-Users-shreyasgupta-local-documents/memory/MEMORY.md`
