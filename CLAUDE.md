# Shreyas's Personal Website

This personal website will be the home to publish my writings, design case studies, experiments, and other creative work.

Read the @package.json file for available npm commands for this project.

## Tech Stack
Astro 5 (static) · React 19 · Tailwind v4 (Vite plugin) · Markdoc · Motion · Biome · TypeScript

## On-Demand Docs
Read the relevant doc BEFORE making changes in that area:

`.claude/docs/widgets.md` — When touching WidgetStrip, any widget component, or widget.toml

## Components
- Widget components: create all widget components in @src/components/widgets/ and use @src/lib/ for shared logic or utility functions.

## Hard Rules
- Simplicity first. Start with the simplest implementation then layer in complexity as needed.
- Paper MCP is our source of truth, liberally use it to check for visual parity.
- Create semantic tokens from `@theme` in @src/styles/global.css only when the style is reusable across multiple components.
- Prefer using motion package for animations over custom CSS animations.
