# Local health dashboard

## Goal

Add a private development-only `/health` dashboard that reads the existing remote D1 database through the local Astro dev server and renders a small set of Apple Health and medical-report trends.

## Success criteria

1. `/health` is registered only for `astro dev`; production build, preview, and sitemap contain no health route.
2. D1 access stays server-side in a development-only integration; no Cloudflare credentials or raw database access ship to the browser.
3. The dashboard shows daily activity, recovery, sleep, VO2 max, and selected medical-report trends with correct per-metric rollups and explicit missing-data behavior.
4. Shared dashboard and chart components live in `src/components/health/`, use React-owned SVG with D3 geometry, and include text alternatives.
5. Focused tests, repository checks, a production build exclusion check, and one rendered-DOM browser probe pass.

## Implementation

1. Add a dev-only Astro integration and D1 JSON endpoint under `src/dev/`; inject the page only for the `dev` command.
2. Add the page entrypoint under `src/dev/pages/` and shared health UI under `src/components/health/`.
3. Add focused tests for route exclusion and D1 response shaping, then run repository verification and browser checks.

