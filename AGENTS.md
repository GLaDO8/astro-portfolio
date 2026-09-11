# Shreyas's Personal Website

Personal site for writing, design case studies, experiments, and creative work.
Prefer simple, focused implementations appropriate for a personal site.

## Stack and navigation

Astro (static), React, Tailwind CSS v4 (Vite plugin), Markdoc, Motion,
Biome, TypeScript, and Lenis. See `package.json` and `pnpm-lock.yaml`
for dependency versions.

- `src/layouts/Document.astro` — shared document/app shell, global setup,
  and route-transition lifecycle.
- `src/layouts/Page.astro` — standard interior-page layout and content grid.
- `src/components/Navbar.astro` — shared navigation and route-change syncing.
- `src/styles/global.css` — global styles and shared `@theme` tokens.

## Project conventions

- Use `pnpm` for package management and repo scripts; use npm only for
  explicitly requested npm-compatibility work.
- Keep planning artifacts in `plans/`; do not create or symlink root
  `plan.md`, even if general planning guidance requests it.
- Keep dev-only UI and helpers under `src/dev/`.
- Use `cn()` from the `cn` package for conditional or concatenated classes
  (`import { cn } from "cn"`); do not add a local wrapper.
- Prefer Tailwind's spacing/sizing scale over arbitrary values.
  Round Figma/Paper measurements to the nearest scale value.
- Add semantic `@theme` tokens only for styles reused across components.
  One-off arbitrary colors are acceptable; promote them when reused.
- Prefer Motion APIs over complex custom CSS animations.

## Verification

- Read-only tasks: do not run verification scripts.
- Narrow code changes: start with `pnpm run verify:changed`.
  It checks working-tree changes and selects tests by file; run additional
  relevant tests when the changed behavior is not covered.
- Markdoc, content, or routing changes: use `pnpm run verify:content`,
  which runs content tests and an Astro build.
- `pnpm run build:astro` skips image preprocessing.
  `pnpm run build` runs image preprocessing and the production build.
- After relevant checks pass, broaden or repeat verification only for
  new edits, failures, or unresolved risks. Avoid duplicate builds.

## UI and DOM changes

For structural styling, complex DOM changes, or CSS/layout debugging,
inspect the rendered DOM before editing. Do not infer final parent/child
relationships across Astro/React boundaries from source alone.

Use one focused `agent-browser eval` per concern where possible:
inspect the visible target's computed styles, bounding rect, relevant
parent chain, and `outerHTML`. Identify the winning CSS rule before
adding overrides.

After each coherent fix, recheck the affected properties on the actual
visible element. Verify changed interactions in the browser when relevant.
If browser verification is unavailable, state what remains unverified.
