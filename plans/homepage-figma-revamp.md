# Homepage Figma Revamp Plan

Created: 2026-04-27
Status: draft

## Source

- Figma design: `https://www.figma.com/design/ocBdmzxLqc9qT6PK88ODnJ/Site?node-id=1907-8671`
- Figma node: `1907:8671`
- Existing implementation references:
  - `src/pages/index.astro`
  - `src/components/Navbar.astro`
  - `src/components/HeroSection.tsx`
  - `src/components/widgets/PhotoFrameWidget.astro`
  - `src/components/widgets/MusicWidget.tsx`
  - `src/components/widgets/SnapsWidget.tsx`
  - `src/pages/case-studies/[...slug].astro`
  - `src/layouts/Page.astro`
  - `src/components/SiteShell.astro`

## Problem Frame

The homepage should become a focused landing page instead of a mixed feed of work, notes, and large cards. The Figma design is a compact centered composition: a simple nav, a three-object widget strip, hero title/actions, and one body paragraph. The wider site still owns work and notes on their dedicated pages.

## Visual Read

- Background is the existing parchment tone, close to Figma `#f4f5f0`.
- Page shell is centered at a 1280px max width.
- Content occupies the same 8-column lane used by case-study body content: `col-span-full md:col-span-8 md:col-start-3 lg:col-span-8 lg:col-start-5`.
- The effective desktop content width is around 628px, with 24px internal padding in Figma.
- Nav is not the current pill/segmented control. It is flat text: brand left, three links right.
- Brand row is `shrey.fyi` plus a small circular angle-down caret. The brand should link to `/`; the caret only needs to render for now.
- Main nav labels are lowercase: `work`, `sidequests`, `notes`.
- Widget strip is a fixed-height collage above the hero, not a card grid. Three existing widgets need compact "object" variants:
  - photo frame: tilted image, post-it, `Click pls` label with small circular caret
  - music: album sleeve/vinyl object, waveform above, `Aphex Twin #3` label
  - snaps: three small polaroids, tape, `Photo Roll` label with small circular caret
- Hero title is larger than the current implementation: Figma uses 36px, 1.4 line height, semibold.
- Hero body is a single paragraph visually, Figma uses 20px text at 1.8 line height.
- Social links in the Figma comp show GitHub and X only. The current `HeroSection.tsx` also includes Instagram, which should be removed from the homepage hero unless the design changes.

## Requirements Trace

- Navbar has exactly three nav links: `work`, `sidequests`, `notes`.
- `work` maps to `src/pages/work.astro` via `/work`.
- `notes` maps to `src/pages/notes/index.astro` via `/notes`.
- `sidequests` maps to a new `src/pages/sidequests.astro` route.
- `shrey.fyi` links to `/` and renders a down-caret icon next to it.
- The caret menu is out of scope for this pass; only the icon is required.
- Add compact `MusicWidget` and `SnapsWidget` variants alongside `PhotoFrameWidget`, rather than keeping them lower in the old homepage feed.
- The rest of the homepage is the existing `HeroSection.tsx` behavior plus the hero description paragraph.
- Remove the old homepage work/notes card sections from `src/pages/index.astro`.
- Preserve the 16-column page grid and 8-column content lane pattern used by case studies.

## Implementation Units

### 1. Navbar Refactor

Files:
- `src/components/Navbar.astro`
- `src/lib/navbar-active-path.js`
- `tests/navbar-active-path.test.mjs`

Plan:
- Replace the pill track and sliding indicator with a flat flex layout matching Figma.
- Use brand link on the left and nav links on the right.
- Render the caret as an inline icon or lucide-style chevron if an icon dependency already exists. Do not add a dependency just for this.
- Keep `transition:persist` ownership in `src/components/SiteShell.astro`; the navbar should still survive Astro route transitions.
- Update active-state logic for lowercase nav labels. `work` should still stay active for `/case-studies/*`.
- Add `/sidequests` active-path coverage.

Tests:
- Extend `tests/navbar-active-path.test.mjs` for `/notes`, `/notes/[slug]`, `/sidequests`, and `/case-studies/[slug]`.

### 2. Sidequests Route

Files:
- `src/pages/sidequests.astro`
- Optional follow-up: `src/pages/experiments.astro`

Plan:
- Add a new sidequests page using `Page.astro` and the same 8-column lane as `work` and `notes`.
- Start with a simple page stub unless sidequest content exists elsewhere.
- Decide later whether `experiments.astro` should redirect, stay hidden, or be removed. Do not remove it in this pass unless explicitly requested.

Tests:
- Covered by build output and navbar active-path tests.

### 3. Homepage Structure

Files:
- `src/pages/index.astro`
- `src/components/HeroSection.tsx`
- `src/layouts/Page.astro` only if the existing spacing cannot express the design cleanly.

Plan:
- Keep `Page.astro` and the existing 16-column shell.
- In `index.astro`, keep the outer lane class from the current homepage and case-study article: `col-span-full md:col-span-8 md:col-start-3 lg:col-span-8 lg:col-start-5`.
- Replace the current homepage content with:
  - widget strip
  - hero section
  - single description paragraph
- Remove top-level `getCollection` calls for notes and case studies from `index.astro`, since the redesigned homepage no longer renders those sections.
- Keep `getWidgetConfig()` and `getSongData()` only if the compact widgets still need them.
- Consider making the hero title size configurable or updating `HeroSection.tsx` directly if this component is only used on the homepage.

Tests:
- `npm run build`
- Browser DOM verification on `/`: computed content lane width, nav layout, heading size, body paragraph line height.

### 4. Compact Widget Strip

Files:
- `src/components/widgets/HomeWidgetStrip.astro` or `src/components/widgets/HomeWidgetStrip.tsx`
- `src/components/widgets/PhotoFrameWidget.astro`
- `src/components/widgets/MusicWidget.tsx`
- `src/components/widgets/SnapsWidget.tsx`

Plan:
- Add a wrapper component for the collage so `index.astro` stays readable.
- Prefer compact variants or props over rewriting the existing full-card widgets:
  - `PhotoFrameWidget.astro`: add label/caret affordance and desktop scale/tilt option.
  - `MusicWidget.tsx`: add a compact mode that suppresses the bordered card and renders only the album/vinyl object plus label.
  - `SnapsWidget.tsx`: add a compact mode that suppresses the card copy and renders the polaroid cluster plus label/tape.
- If compact variants make the components too branchy, split internals into reusable smaller pieces and keep existing widgets intact for other pages.
- Use Motion for existing interactive behavior where already present, but do not add new complex physics in this pass.
- Ensure the strip has stable dimensions so widget labels and rotations do not reflow the hero.

Tests:
- Browser screenshot check on desktop.
- Mobile screenshot check because the desktop collage likely needs a stacked or scaled-down composition.
- Reduced-motion check for compact React widgets.

### 5. Styling and Tokens

Files:
- `src/styles/global.css`
- Component files above

Plan:
- Use existing tokens where they match: `bg-parchment`, `text-charcoal`, `text-slate`, `bg-mist`.
- Avoid adding new `@theme` tokens unless a value is reused across multiple components.
- Figma text color `#282824` is close enough to `text-charcoal` unless visual verification shows it is materially off.
- Figma muted icon/nav surface `#e7e9dd` may become a local arbitrary color first; promote only if repeated.

Tests:
- `npm run check:design`
- `npm run check`

## Sequencing

1. Update navbar and active-path tests first.
2. Add `src/pages/sidequests.astro`.
3. Replace homepage data and layout in `src/pages/index.astro`.
4. Add the compact widget strip and variants.
5. Tune `HeroSection.tsx` typography and social link set.
6. Run tests and inspect rendered DOM/screenshots for the final layout.

## Open Decisions

- Whether `/experiments` should become a redirect to `/sidequests` or stay as an unlinked legacy route.
- Exact mobile behavior for the three-widget collage. The Figma reference is desktop-first; implementation should avoid breakpoint sprawl and verify the rendered DOM before finalizing mobile positioning.
- Whether `PhotoFrameWidget`, `MusicWidget`, and `SnapsWidget` should expose `variant="compact"` props or whether separate homepage-only components are cleaner.
- Which sideproject links belong in the future `shrey.fyi` caret menu. `co2.shrey.fyi` is the only confirmed example.

## Definition of Done

- Homepage visually matches the provided Figma desktop composition at the 1280px shell width.
- Navbar shows only `shrey.fyi`, caret, `work`, `sidequests`, and `notes`.
- `/work`, `/sidequests`, and `/notes` routes exist and nav active state is correct.
- Homepage no longer fetches/render case studies or notes.
- The three compact widgets render in the hero strip without layout shift.
- Build, tests, Biome, and design-token checks pass.
- Rendered DOM verification confirms the 16-column page grid and 8-column content lane are intact.
