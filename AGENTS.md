# Shreyas's Personal Website

This personal website will be the home to publish my writings, design case studies, experiments, and other creative work.

## Tech Stack
Astro 6 (static) · React 19 · Tailwind v4 (Vite plugin) · Markdoc · Motion · Biome · TypeScript · Lenis (for smooth scrolling)

## On-Demand Docs
Read the relevant doc BEFORE making changes in that area:

`.claude/docs/tailwind.md` — when styling elements using tailwind css

## Key Files
- `src/layouts/Base.astro` — document-level layout. Owns SEO, font preloading, global CSS, `ClientRouter`, Lenis bootstrapping, skip link, and dev-only toolbar mounting.
- `src/components/SiteShell.astro` — in-body site shell. Owns the shared max-width container, navbar placement, main content wrapper, and page enter/leave state used by shell transitions.
- `src/layouts/Page.astro` — standard interior page layout. Composes `Base` + `SiteShell` and applies the default content grid for non-home pages.
- `src/components/Navbar.astro` — segmented top navigation. Owns active-link detection, sliding indicator positioning, and client-side re-sync after Astro route transitions.
- `src/components/HeroSection.tsx` — animated homepage intro. Cycles description lines with Motion while respecting reduced-motion preferences.
- `src/components/SEO.astro` — shared meta tags, canonical URL generation, Open Graph/Twitter tags, favicons, and optional JSON-LD output.

## Code style and conventions
- Simplicity first. Start with the simplest implementation then layer in complexity as needed.
- Paper & Figma MCP if provided, is your source of truth, liberally use it to check for visual parity.
- Create semantic tokens from `@theme` in @src/styles/global.css only when the style is reusable across multiple components.
- Prefer using motion package for animations over complex custom CSS animations.

### Using Tailwind CSS for styling
- Use `cn()` for conditional class composition and concatenation.
- Promote reusable values to `@theme` in `src/styles/global.css`
- Avoid arbitrary one-off spacing/sizing values like `pt-[23px]`.
- If arbitrary values are dictated by Figma or Paper MCP, use the nearest Tailwind scale value.
- Arbitrary colors (`bg-[#hex]`) are OK temporarily; promote to `@theme` token if reused.

## CSS & Layout Bug Protocol
When debugging CSS/layout issues, **never edit styles based on source code alone**. The rendered DOM is the source of truth — source files pass through build transforms that may inject, scope, or override styles in ways not visible in source.

- **Inspect before editing** — Use `agent-browser eval` to run `getComputedStyle()` on the target element and its parent chain for relevant properties. Dump `outerHTML` to see the actual rendered markup and any injected inline styles or wrapper elements.
- **Identify the winning rule** — Before writing overrides, determine what's currently winning the cascade (inline styles, scoped selectors, utility classes, browser defaults). Know the specificity you're fighting.
- **Verify after each change** — Re-run `getComputedStyle` to confirm the target property actually changed. Screenshots show *what's wrong*, computed styles show *why*.
