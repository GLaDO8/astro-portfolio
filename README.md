# Shreyas's Personal Website

This is the source for `shrey.fyi`, a static personal website for writing, design case studies, experiments, side projects, and visual notes.

## Tech Stack

- **Astro 6** for the static site, routing, content collections, font loading, and build pipeline.
- **React 19** for interactive islands such as widgets, galleries, copy buttons, and animated sections.
- **Markdoc / MDOC** for long-form notes and case studies in `src/content`.
- **Tailwind CSS v4** through the Vite plugin, with shared tokens in `src/styles/global.css`.
- **Motion** for interface and page-level animation.
- **Lottie** through `lottie-web` for embedded motion pieces inside MDOC content.
- **Lenis** for smooth scrolling behavior.
- **Biome** for formatting and linting.
- **Sharp** plus local image scripts for asset optimization.

## Project Structure

```txt
src/
  pages/              Astro routes for home, notes, work, snaps, experiments, etc.
  layouts/            Shared document, page, and special-case layouts.
  components/         Astro and React UI components.
  components/mdoc/    Custom Markdoc renderers and tags.
  components/widgets/ Homepage and site widgets.
  content/            MDOC notes and case studies.
  assets/             Local images, fonts, Lottie/media assets, and 3D files.
  styles/             Global CSS and Tailwind theme tokens.
  lib/                Shared helpers for content, images, nav state, and utilities.
  dev/                Development-only overlays and tooling UI.

public/               Static public assets.
scripts/              Verification and image optimization scripts.
tests/                Node test files.
plans/                Repo-local planning notes.
```

Key config files:

- `astro.config.mjs` configures Astro, React, Markdoc, sitemap, local fonts, Tailwind, and static output.
- `markdoc.config.ts` defines custom MDOC nodes and tags such as figures, sidenotes, accordions, image pairs, marquees, code blocks, refs, and Lottie embeds.
- `src/content.config.ts` defines the `notes` and `caseStudies` content collections.

## Running Locally

Use `pnpm`; the repo pins `pnpm@10.33.0` in `package.json`.

```sh
pnpm install
pnpm dev
```

Astro serves the site at `http://localhost:4321` by default.

Useful commands:

```sh
pnpm run build          # optimize images, then build the static site
pnpm run build:astro    # run Astro build without the image prepass
pnpm run preview        # preview the production build locally
pnpm run verify:changed # focused verification for narrow changes
pnpm run verify:content # content, Markdoc, and routing verification
pnpm run check          # Biome checks
```
