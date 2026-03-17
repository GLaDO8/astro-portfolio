# Widgets

## Architecture

WidgetStrip (`src/components/WidgetStrip.tsx`) is the container for all widgets. It renders as a full-width horizontal strip on the homepage.

**Hydration:** `client:visible` — loads JS only when the strip enters the viewport.

## Adding a New Widget

1. Create `src/components/widgets/YourWidget.tsx`
2. Import and add it inside WidgetStrip's `<motion.div>` children
3. If the widget needs build-time config, add a `[section]` to `widget.toml` and parse it in `src/lib/widgetConfig.ts` (or create a new lib file)
4. If the widget needs data in index.astro, pass it as a prop through WidgetStrip
5. Use @src/lib/ for shared logic or utility functions.

## Data Flow
```
widget.toml → src/lib/widgetConfig.ts (build-time parse + iTunes fetch)
    → index.astro (getWidgetConfig, getSongData)
        → WidgetStrip props (songData, photoFrame)
            → individual widget components
```
