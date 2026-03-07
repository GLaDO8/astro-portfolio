# Shreyas's Personal Website — "Metaphysical UI"

A personal website where the UI has physical presence. It reacts to touch (hover), movement (scroll inertia with springs), and atmosphere (mouse velocity as "wind"). Subtle but powerful.

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

## Design Source
- **Paper**: `app.paper.design/file/01KJN5YBZRWM0KKM608GZEWZGE`
- Latest homepage frame: node `3D-0`
- Blog post page: node `D-0`
- Previous homepage iteration (with music widget): node `80-0`

## Hard Rules
- **Strictly Tailwind v4 utility classes** — no inline styles, no `<style>` blocks, no CSS modules
- MotionValues for all animated values — never put animated values in React state
- `motion/react/mini` for simple hover/tap; full `motion/react` for physics-tier springs
- Simple interactive first, realistic later. Incremental fidelity.
- Build debug tuning overlay (stiffness/damping/mass sliders) early
- All event listeners passive where possible
- Only animate compositor-friendly properties (transform, opacity, filter)

## Key Conventions
- Fonts: PP Kyoto (headings), EB Garamond (blog body), TX-02 (TBD), Inter Variable (UI)
- Homepage background: `#a7bbc3` (muted blue-grey)
- Blog background: `#e5e8d8` (warm olive/sage)
- Widget radius: 16px, widget gap: 35px
- Content max-width: 727px (from Paper frame)

## Memory System
Long-term memory lives in the Claude Code memory directory, NOT in this repo.
See `/Users/shreyasgupta/.claude/projects/-Users-shreyasgupta-local-documents/memory/MEMORY.md`
