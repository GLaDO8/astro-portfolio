# Phase 1: Homepage Implementation Plan

## Goal
Build the homepage to match the Paper design (frame `3D-0`) with working interactive physics on the widget strip.

## Reference
- Paper design: `app.paper.design/file/01KJN5YBZRWM0KKM608GZEWZGE` node `3D-0`

---

## Step 1: Project Bootstrap
**Status:** Done
- [x] Astro + React + Tailwind V4 + Markdoc + Motion scaffold
- [x] Directory structure, tsconfig, package.json
- [x] Base layout, index page skeleton
- [x] Global CSS with `@theme` design tokens (Tailwind v4)
- [x] Mouse velocity tracker (`src/lib/mouse-tracker.ts`)
- [x] `npm install` and verify dev server runs
- [x] Load fonts (PP Kyoto woff2, EB Garamond woff2, Inter Variable woff2)
- [x] Font preloads in Base.astro
- [x] Fixed Tailwind v4 integration: `@tailwindcss/vite` plugin (not `@astrojs/tailwind`)

## Step 2: Static Homepage Layout
**Status:** Done
- [x] Hero section: "Shrey is" + "Designer. Mushroom grower. Cat dad."
  - PP Kyoto Medium Italic for tagline, Extrabold for title
  - Left-aligned within 727px centered content column
- [x] Widget strip section: 3 widgets (300x200, correct colors/radius)
  - Horizontal layout with 35px gaps
  - Scroll section is 970px wide — breaks out of 727px content column
- [x] Notes section: "Notes" heading + 3 blog entries (title + subtitle)
  - Inter Variable Medium/Regular
- [x] Background: `#a7bbc3`
- [x] Section gaps: uniform 72px between hero→widgets→notes
- [x] Hero text gap: 16px between "Shrey is" tagline and title line
- [x] Notes heading to first entry: 36px
- [x] Hero text color: `#222a37` (different from notes section `#242a2d`)
- [x] All styles use Tailwind v4 utility classes (no inline styles)
- [x] Verified layout matches Paper frame at 1512px viewport

## Step 3: Widget Strip — Horizontal Scroll
**Status:** Done
- [x] `WidgetStrip.tsx` React component
  - Motion drag with `drag: 'x'` (replaced Lenis in commit `0823c8b`)
  - Velocity shared via `scrollVelocity` MotionValue (`src/lib/scroll-velocity.ts`)
- [x] Mount as `<WidgetStrip client:visible />` in index.astro
- [x] Velocity shared via module-level MotionValue (no React context needed)

## Step 4: Photo Frame Widget (First Interactive Widget)
**Status:** Done
- [x] `PhotoFrame.tsx` component
  - Photo image with CSS filter halftone approximation (contrast + grayscale)
  - Halftone base color: `#FBFAF5` (warm off-white)
  - Border-radius 16px + P3 gamut box-shadow on photo child
  - `motion.div` with perspective, rotateX/rotateY springs on pointer move
  - Spring config: stiffness 120, damping 18
- [x] `PostItNote.tsx` component (child of PhotoFrame)
  - `PostItSvg.tsx` — exported hand-drawn SVG from Paper (unique `idPrefix` per instance)
  - Positioned at left:216px, top:127px (overflows frame bounds)
  - Motion springs: `useSpring` for tilt (rotateY) + lift (y)
  - rAF loop reads `scrollVelocity.get()` + `getMouseState()` per frame
  - Scroll velocity → rotateY sway, mouse vx → rotateY flutter
  - Mouse speed → lift, hover → additional lift
  - Spring configs: tilt (100/10/1), lift (150/15/1)
- [x] Velocity wiring: scrollVelocity MotionValue → PostItNote rAF loop

## Step 5: Snaps Widget
**Status:** Done
- [x] `SnapsWidget.tsx` component
  - Green background (`#bdda7d`), rounded-16, P3 gamut shadow
  - "Snaps" title (Inter Variable Bold 30px, P3 dark green)
  - Camera list (Inter Variable Bold 12px, `#607139`)
  - 3 `InstantPhoto` sub-components with photo insets (86x86)
- [x] Each InstantPhoto:
  - White polaroid frame (96x120) with actual photo images
  - Base rotation + scatter position from Paper:
    - 23.83deg, translate(257.6px, -34.2px)
    - -17.18deg, translate(140.7px, 12.9px)
    - 10.45deg, translate(200.9px, 45.3px)
  - `transformOrigin: 0% 0%` on all polaroids
  - Motion spring for hover fan-out (rotation + translate offset)
  - Staggered damping per polaroid index
  - Scroll velocity → shuffle shift via rAF + scrollVelocity MotionValue
- [x] Shadows: dual-layer `#5D5D5D40 0px 4px 18px 2px, #0000002E 0px 0px 4px`

## Step 6a: Music Widget — IMPLEMENTED (added post-plan)
**Status:** Done
- [x] `MusicWidget.tsx` — iTunes fetch, typography, padding refinements
- [x] Widget config in `widget.toml`

## Step 6: Notes Section (was Step 7)
**Status:** Done
- [x] Markdoc content collection setup (`src/content/config.ts`)
  - Astro 5 Content Layer API: `glob` loader for `.mdoc` files
- [x] Sample `.mdoc` files in `src/content/notes/` (3 posts with real content)
- [x] Query content collection in `index.astro` (sorted by date, draft-filtered)
- [x] Render note titles + subtitles (Inter Variable)
- [x] Subtle CSS hover transition on note entries (`hover:translate-x-1.5`)

## Step 7: Debug Tuning Overlay
**Status:** Done
- [x] `DebugOverlay.tsx` — floating panel, toggle with ⌘D / Ctrl+D
- [x] Sliders for each spring: stiffness (10–500), damping (1–50), mass (0.1–10)
- [x] Grouped by widget (Post-it Tilt, Post-it Lift, Photo Frame Tilt, Polaroid Fan)
- [x] Live update via shared reactive store (`src/lib/spring-config.ts`)
  - Module-level `useSyncExternalStore` pattern (same as scroll-velocity singleton)
  - Server snapshot for SSR compat (`client:visible` islands)
- [x] Reset button restores defaults, changed values highlighted amber
- [x] Only loaded in dev mode (`client:only="react"` + `import.meta.env.DEV`)

## Step 8: Polish & Viewport Handling
**Status:** Done
- [x] Responsive layout: `max-w-[727px] w-full px-6` (was fixed `w-[727px]`)
- [x] Widget strip: `w-screen max-w-[970px]` — fills viewport, capped at design width
- [x] Text scaling: `clamp()` for hero, notes heading, note titles/subtitles
  - Hero: `clamp(32px, 5vw, 48px)`, titles: `clamp(22px, 3vw, 28px)`, subtitles: `clamp(16px, 2.5vw, 20px)`
- [x] Widget strip touch drag: handled by Motion `drag="x"` gesture
- [x] Font preloads: 3 critical fonts already preloaded in Base.astro
- [x] Build verified: clean compilation, 1 page in 1.04s
- [ ] Performance audit: verify <16ms frame time (manual testing needed)
- [ ] Screenshot comparison against Paper design (manual testing needed)

---

## Dependencies Between Steps
```
Step 1 (bootstrap) ✅
  └─> Step 2 (static layout) ✅
       ├─> Step 3 (Lenis scroll) ✅
       │    └─> Step 4 (photo frame + post-it) ✅
       │         └─> Step 5 (snaps) ✅
       └─> Step 6 (notes section) ✅
Step 7 (debug overlay) ✅
Step 8 (polish) ✅ (manual perf/screenshot testing remains)
```

## Current JS Bundle Sizes (gzipped)
- `client.js`: 57.51 KB (Astro runtime)
- `WidgetStrip.js`: 7.29 KB (React + Motion drag + springs + spring-config store)
- `index.js`: 3.10 KB + 1.52 KB (island hydration)
- `jsx-runtime.js`: 0.46 KB
- `DebugOverlay.js`: 1.26 KB (dev-only, not in prod)
- `AgentationToolbar.js`: 40.24 KB (dev-only, not in prod)
- **Total interactive (prod)**: ~70 KB gzipped — over 60KB target, majority is Astro runtime

## Definition of Done (Phase 1)
- Homepage matches Paper design at 1512px
- Widget strip scrolls horizontally with Motion drag
- Post-it note reacts to: scroll velocity, mouse velocity, hover
- Polaroids fan on hover, shift on scroll
- Notes section shows blog entries from Markdoc content
- Debug overlay allows live spring tuning
- <60KB total interactive JS (React + Motion + widgets)
- <16ms frame time during peak interaction (scroll + hover)
