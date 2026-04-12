# Astro `Image` Migration Plan

## Goal

Replace plain browser `<img>` usage with Astro's `Image` component where it provides build-time value:

- inferred intrinsic dimensions for local assets in `src/`
- automatic `decoding="async"` and lazy behavior defaults
- Astro image pipeline optimizations and transformed output
- less hand-maintained width/height metadata

This migration should only target images that are static and known at build time. Dynamic runtime URLs and DOM-created images should stay on plain `<img>` unless we redesign the data flow around them.

## Current State

### Static/editorial `.astro` components

- `src/components/mdoc/Figure.astro`
- `src/components/mdoc/ImagePair.astro`
- `src/components/mdoc/ImageMarquee.astro`
- `src/components/mdoc/Sidenote.astro`
- `src/components/widgets/PhotoFrameWidget.astro`
- `src/pages/snaps.astro`

### React components using `<img>`

- `src/components/widgets/SnapsWidget.tsx`
- `src/components/widgets/MusicWidget.tsx`

### Current asset locations

- Most editorial and gallery images are in `public/case-studies/...` and `public/snaps/...`
- Some decorative/widget assets are in `public/` root:
  - `/halftone-photo.webp`
  - `/postit-me.svg`
  - `/record content.png`
  - `/specular highlight.svg`
  - `/tail.svg`
  - `/tonearm.png`

## Astro Constraints To Design Around

Based on current Astro docs:

- `Image` works best with local files imported from `src/`; Astro can infer width and height from those files.
- `Image` can also render `public/` or remote URLs, but width and height must be provided manually in those cases, so we lose the main win.
- `.astro` files can use `Image` directly.
- React `.tsx` components in this repo cannot just swap to Astro's `Image`; if we want optimization there, the asset handling must move up into an `.astro` boundary or the component API must accept imported metadata.
- Images inserted by imperative client-side DOM code cannot use Astro's `Image` without changing the rendering strategy.

## Migration Buckets

### Bucket A: Migrate first

These are static `.astro` render paths and should move to `Image` plus `src` imports early.

- `src/components/mdoc/Figure.astro`
- `src/components/mdoc/ImagePair.astro`
- `src/components/mdoc/ImageMarquee.astro`
- `src/components/mdoc/Sidenote.astro`
- `src/components/widgets/PhotoFrameWidget.astro`

Reason:

- the markup is server-rendered in `.astro`
- these are reusable editorial primitives
- they currently take string paths pointing at local assets in `public/`
- this is the cleanest place to centralize imported image metadata

### Bucket B: Migrate with a small data refactor

- `src/pages/snaps.astro`
- `src/components/widgets/SnapsWidget.tsx`

Reason:

- assets are local and static, so they are good candidates for `src` imports
- current code stores `src` as strings and manually maintains dimensions
- `snaps.astro` also renders deferred rows via client-side `document.createElement("img")`, which blocks a direct `Image` swap for the deferred portion

### Bucket C: Keep on plain `<img>` for now

- `src/components/widgets/MusicWidget.tsx` album art via `songData.albumArt`

Reason:

- `albumArt` comes from the iTunes API at runtime
- Astro cannot infer dimensions from a runtime remote URL
- the inline SVG `<image>` element is already doing custom clipping; optimizing that path is a separate concern

Potential partial migration in this file:

- local decorative assets such as `/tail.svg`, `/record content.png`, `/specular highlight.svg`, and `/tonearm.png` can be reconsidered later, but only if rendering is moved into an `.astro` wrapper or those assets are passed in as imported metadata from a server boundary

## Asset Relocation Plan

Create a dedicated source-owned image tree under `src/` for all images that will be rendered through Astro `Image`.

Suggested structure:

- `src/assets/case-studies/hottext/...`
- `src/assets/snaps/...`
- `src/assets/widgets/...`

Move these categories out of `public/`:

- case study images currently referenced by Markdoc components
- snaps photos used by `src/pages/snaps.astro`
- local widget/decorative images used by `PhotoFrameWidget.astro`
- optionally local static images used by `SnapsWidget.tsx` if we later lift rendering into `.astro`

Keep these in `public/`:

- favicons, manifest icons, and other direct public web assets
- files that must be addressable by a fixed public URL without importing
- runtime-fetched or CMS-like images that are not known at build time

## Implementation Phases

## Phase 1: Inventory and naming cleanup

- Create `src/assets/` subfolders for `case-studies`, `snaps`, and `widgets`
- Move the static images that are currently consumed by `.astro` files out of `public/`
- Leave `public/` copies in place temporarily if needed for a staggered rollout, then remove them after references are updated
- Review `scripts/optimize-images.mjs` because it currently only watches and rewrites references inside `public/`; it should either:
  - continue owning only true public assets, or
  - be retired for migrated images if Astro's image pipeline becomes the source of truth

## Phase 2: Build reusable image-aware component APIs

Refactor the Markdoc-facing `.astro` components so they can accept local imported image metadata, not only string URLs.

Targets:

- `Figure.astro`
- `ImagePair.astro`
- `ImageMarquee.astro`
- `Sidenote.astro`
- `PhotoFrameWidget.astro`

Recommended API direction:

- accept `ImageMetadata`-compatible props for local images
- allow a narrow fallback path for remote/public string URLs only where truly necessary
- keep existing layout/styling classes unchanged during the first pass

Important design choice:

- do not try to preserve a single `src: string` API everywhere if it prevents use of `Image`
- prefer a deliberate split such as `image` metadata for local optimized assets and `src` string only for explicit fallback cases

## Phase 3: Update content entry points

The Markdoc content currently references `public/` paths directly, for example in:

- `src/content/case-studies/hot-text.mdoc`
- `src/content/case-studies/hot-text-draft.mdoc`

Because those files pass strings like `"/case-studies/hottext/ht-image1.png"` into custom components, a direct `Image` migration needs one of these approaches:

1. Pre-import images in the page/layout layer and pass them into components as props.
2. Introduce a lookup layer that maps stable content keys to imported assets.
3. Keep Markdown image syntax as plain URLs and only migrate custom Markdoc tags/components.

Recommended approach:

- use a lookup map for custom Markdoc tags first
- avoid trying to parse/import every bare Markdown image in the first iteration

That gives a controlled path for:

- `{% figure %}`
- `{% sidenote %}`
- `{% carousel %}` / marquee-like image lists

without requiring a broad content format rewrite.

## Phase 4: Convert the snaps page

`src/pages/snaps.astro` is the highest-value page migration because it currently maintains a large manual dimension map.

Recommended change:

- import all snap images from `src/assets/snaps`
- replace the `snapDimensions` object with image metadata from imports
- store each snap item as `{ image, date, year, caption, span }` instead of `{ src, width, height, ... }`

Rendering strategy:

- convert the initially rendered rows to Astro `Image`
- for deferred rows, choose one of:
  - render all rows server-side and rely on `loading="lazy"` if that is performant enough
  - render deferred rows as hidden server-rendered markup that is revealed later
  - keep deferred rows on `<img>` temporarily and migrate only the initial rows first

Recommended first pass:

- migrate the initial rows completely
- remove manual dimension bookkeeping
- defer the DOM-created row migration to a second pass if needed

## Phase 5: Revisit React widget boundaries

### `SnapsWidget.tsx`

The images are local and static, but the component is React. Options:

1. Keep `<img>` in React for now, but source the paths from a central asset manifest.
2. Wrap the visual in an `.astro` component and pass layout data into a smaller client component.
3. Pass imported image metadata into React and render a regular `<img>` using the generated URL.

Recommended approach:

- do not block the main migration on this widget
- migrate the page-level and Markdoc paths first
- later decide whether this widget is worth moving behind an `.astro` boundary

### `MusicWidget.tsx`

Keep as-is for album art. Only reconsider local decorative assets later if the component boundary changes.

## Verification

- run a full build after each phase
- visually verify case study pages, the snaps page, and the homepage widgets
- confirm that migrated images now emit Astro-managed output and no longer rely on manual width/height constants where local imports are used
- check for broken content references after moving files out of `public/`
- compare layout stability on first render, especially on `snaps.astro`

## Risks

- Markdoc content currently assumes string paths; forcing `Image` through that API too early can create awkward content plumbing
- moving all `public/snaps` assets at once could break any direct links if those URLs are referenced elsewhere
- the deferred DOM rendering in `snaps.astro` is incompatible with a naive `Image` swap
- the current image optimization script may conflict with or become redundant after the migration

## Recommended Rollout Order

1. Migrate `PhotoFrameWidget.astro` and the Markdoc helper components in `src/components/mdoc/`
2. Move case study and widget images from `public/` to `src/assets/`
3. Convert `src/pages/snaps.astro` initial rows and remove manual dimensions
4. Decide whether to simplify or redesign deferred row rendering
5. Revisit React widgets only after the Astro-native paths are done

## Definition of Done

- all static local images rendered from `.astro` components use Astro `Image`
- those images live under `src/assets/` rather than `public/`
- the snaps page no longer relies on the hand-maintained `snapDimensions` table for migrated rows
- Markdoc custom image components support optimized local assets cleanly
- remaining plain `<img>` usage is intentional and documented as dynamic, remote, or client-only
