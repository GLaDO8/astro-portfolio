# Architecture

## Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Static shell | Astro | SSG, View Transitions, island architecture |
| Interactive islands | React | Ecosystem, MDX/Markdoc support, one framework for all islands |
| Animation | Motion (`motion/react`) | Spring physics, drag gestures, MotionValues bypass React renders, velocity readback |
| Scroll | Lenis | Smooth horizontal scroll, velocity exposure per frame, wheel normalization |
| Blog content | Markdoc | Custom tags for components, file-based CMS, Obsidian-compatible |
| Styling | Tailwind V4 | Design tokens as CSS custom properties |
| Deploy | Cloudflare Pages | Edge SSG |

## Data Flow: How Signals Become Motion

```
INPUT SIGNALS                    MOTION ENGINE              OUTPUT
--------------                   -------------              ------
Scroll (Lenis)
  -> velocity per frame ----+
                             |   MotionValues
Mouse movement               +-> (spring physics,    --> CSS transforms
  -> mouse-tracker.ts ---+  |    drag, gestures)        opacity, filter
                          |  |
Hover/pointer events -----+--+
                          |
Drag (vinyl scratch) -----+
```

## Performance Model

- All animated values are MotionValues (bypass React render cycle)
- MotionValues -> direct DOM style mutations (no VDOM diffing)
- Only compositor-friendly properties: transform, opacity, filter
- Lenis velocity feeds into Motion springs as external signal
- Mouse tracker: ~15 lines, exponential moving average smoothing
- IntersectionObserver pauses widget strip when off-screen

## View Transitions

- Astro `<ClientRouter />` for SPA-like page transitions
- Spring curves via `spring-easing` package -> CSS `linear()` easing
- `astro:before-swap` -> `event.viewTransition.ready` -> WAAPI with spring keyframes
- `transition:name` for morphing elements (note title -> blog post hero)
- `transition:persist` for React islands that survive navigation

## Project Structure

```
src/
  pages/          # Astro pages (index.astro, notes/[slug].astro)
  layouts/        # Base.astro, BlogPost.astro
  components/
    widgets/      # React components: PhotoFrame, Snaps, PostIt, etc.
    WidgetStrip.tsx  # Lenis wrapper + velocity distribution
  lib/
    mouse-tracker.ts  # Global mouse velocity (vanilla JS)
  styles/
    global.css    # Tailwind V4 + design tokens
  content/
    notes/        # Markdoc blog posts (.mdoc files)
```
