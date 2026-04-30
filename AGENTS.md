# Shreyas's Personal Website
This personal website will be the home to publish my writings, design case studies, experiments, and other creative work.

## Tech Stack
Astro 6 (static) · React 19 · Tailwind CSS v4 (Vite plugin) · Markdoc · Motion · Biome · TypeScript · Lenis (for smooth scrolling)

## Key Files
- `src/layouts/Document.astro` — document and app-shell layout. Owns SEO, font preloading, global CSS, `ClientRouter`, Lenis bootstrapping, skip link, dev-only toolbar mounting, shared max-width shell, optional navbar, main content wrapper, and page enter/leave state used by shell transitions.
- `src/layouts/Page.astro` — standard interior page layout. Composes `Document` and applies the default content grid for non-home pages.
- `src/components/Navbar.astro` — segmented top navigation. Owns progressive navbar blur, sticky placement, persisted transition wrapper, active-link detection, subdomain menu behavior, and client-side re-sync after Astro route transitions.

## Code style and conventions
- Simplicity first, this is a personal website not enterprise software. Start with the simplest implementation then layer in complexity as needed.
- Keep every planning artifact inside `plans/`. Use `plans/plan.md` as the active plan/index when a generic plan pointer is needed; do not create, symlink, or leave `./plan.md` in the project root. If a tool generates a root `plan.md`, move it into `plans/` before continuing. This repo-local rule overrides the general planning-doc instruction to symlink an active plan at `./plan.md`.
- When using Paper MCP for recreation or parity work, read the repo-local skill at `.codex/skills/paper-parity/SKILL.md` first.
- Create semantic tokens from `@theme` in @src/styles/global.css only when the style is reusable across multiple components.
- Prefer using Motion library APIs for animations over complex custom CSS animations.
- Use `cn()` for conditional class composition and concatenation.
- Promote reusable values to `@theme` in `src/styles/global.css`
- Avoid arbitrary one-off spacing/sizing values like `pt-[23px]`. If arbitrary values are dictated by Figma or Paper MCP, use the nearest Tailwind scale value.
- Arbitrary colors (`bg-[#hex]`) are OK temporarily; promote to `@theme` token if reused.

## Understand the DOM
For structural styling, complex DOM changes, or CSS/layout debugging, inspect the rendered DOM first. The rendered DOM is the source of truth. Do not infer selector paths from Astro/React source alone when the change depends on parent/child relationships in the final DOM.

This includes:
- parent-driven styling like `*:` selectors, arbitrary selector variants, descendant/child combinators, and group/peer patterns
- Astro wrapper behavior such as `astro-island`, slots, scoped styles, and generated markup
- React/Astro component boundaries where the source tree may not match the final DOM tree

Use the following workflow:
- **Inspect before editing** — Use `agent-browser eval` to run `getComputedStyle()` on the target element and its parent chain for relevant properties. Dump `outerHTML` to see the actual rendered markup and any injected inline styles or wrapper elements.
- **Identify the winning rule** — Before writing overrides, determine what's currently winning the cascade (inline styles, scoped selectors, utility classes, browser defaults). Know the specificity you're fighting.
- **Verify after each change** — Re-run `getComputedStyle()` to confirm the target property changed on the actual visible element, not just a wrapper. Screenshots show *what's wrong*; computed styles show *why*.
- Changes which aren't minor need to be verified by inspecting the DOM, see instructions below.
