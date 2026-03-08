# Shreyas's Personal Website — "Metaphysical UI"

## Stack
- **Astro** — Static shell, View Transitions, Markdoc for blog content
- **React islands** — Interactive widgets and components (hydrated on demand)
- **Motion** (formerly Framer Motion) — Spring animation, drag gestures, MotionValues bypass React renders
- **Lenis** — Smooth horizontal scroll for widget strip (exposes velocity per frame)
- **Tailwind V4** — `@tailwindcss/vite` plugin, `@theme` for tokens, ALL styles via utility classes
- **Markdoc** — Blog content with custom tags (file-based CMS, Obsidian-compatible later)
- **Cloudflare Pages** — Deployment

## Docs Index (progressive disclosure — read what you need)
| Doc | When to read |
|-----|-------------|
| `docs/architecture.md` | Stack decisions, data flow, performance model |
| `docs/design.md` | Design tokens, fonts, colors, spacing — sourced from Paper |
| `docs/widgets.md` | Widget specs, interactions, spring params, signal mapping |
| `docs/blog.md` | Markdoc setup, content collections, blog page layout |
| `plans/` | Implementation plans by phase |
| `plan.md` | Symlink to current active plan |

## Hard Rules
- **Strictly Tailwind v4 utility classes** — no inline styles, no `<style>` blocks, no CSS modules
- Paper MCP is our source of truth, liberally use it to check for visual parity. 
- Use claude chrome MCP aggressively to test your localhost implementation. Keep iterating till bugs & issues are solved.

## Memory System
Long-term memory lives in the Claude Code memory directory, NOT in this repo.
See `/Users/shreyasgupta/.claude/projects/-Users-shreyasgupta-local-documents/memory/MEMORY.md`
