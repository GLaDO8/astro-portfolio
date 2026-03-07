# Design Tokens & Visual Reference

Sourced from Paper file: `app.paper.design/file/01KJN5YBZRWM0KKM608GZEWZGE`

## Color Palettes

### Homepage
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-home` | `#a7bbc3` | Page background |
| `--color-text-hero` | `#222a37` | Hero section text (slightly bluer) |
| `--color-text-primary` | `#242a2d` | Notes headings, titles, body |
| `--color-text-secondary` | `#354b54` | Subtitles |
| `--color-green-label` | `#7f964c` | "WEEKLY OBSESSIONS" label |
| `--color-snaps-title` | `color(display-p3 0.121 0.153 0.016)` | Snaps "Snaps" title (P3 dark green) |
| `--color-green-dark` | `#607139` | Snaps camera list |
| `--color-snaps-bg` | `#bdda7d` | Snaps widget background |
| `--color-halftone-base` | `#fbfaf5` | Halftone shader background (warm off-white) |

### Blog
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-blog` | `#e5e8d8` | Blog page background (warm olive/sage) |

## Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Hero tagline ("Shrey is") | PP Kyoto | Medium Italic | 48px | - |
| Hero title | PP Kyoto | Extrabold | 48px | - |
| Section headings ("Notes") | PP Kyoto | Extrabold | 48px | - |
| Widget titles ("Snaps") | Inter Variable | Bold | 30px | -0.6px |
| Widget labels | Inter Variable | Bold | 12px | - |
| Widget body | Inter Variable | Medium | 24px | -0.48px |
| Note titles | Inter Variable | Medium | 28px | - |
| Note subtitles | Inter Variable | Regular | 20px | - |
| Blog body | EB Garamond | Regular | ~18px | - |
| Blog headings | EB Garamond | Bold | varies | - |

## Spacing

| Token | Value |
|-------|-------|
| Widget gap | 35px |
| Widget radius | 16px |
| Content max-width | 727px |
| Scroll section width | 970px (breaks out of content column) |
| Hero text gap | 16px (between tagline and title) |
| Note title/subtitle gap | 12px |
| Note-to-note gap | 24px |
| Notes heading to first entry | 36px |
| Section gap | 72px (uniform between all sections) |

## Widget Dimensions (from Paper)

All widgets: 300x200px, rounded-16px
- Photo frame: 300x200, halftone CMYK shader (`ShaderHalftoneCmyk`), post-it SVG overlay
- Snaps: 300x200, green bg (#bdda7d), 3 scattered polaroids (96x120 each)
- Music (from previous iteration, node `80-0`): NOT in current frame `3D-0`, Phase 2+

## Special Effects

- **Halftone CMYK shader**: Applied to photo frames. Newspaper dot pattern.
  Implementation options: CSS filter, SVG filter, or WebGL shader.
  The simplest approach for v1: CSS `filter` with a dot-pattern SVG overlay.
- **Post-it note**: Yellow SVG with handwritten "Me!" text, folded corner, drop shadow filter.
  Positioned at left:216px, top:127px relative to photo frame (overflows frame bounds).
  Identical positioning on both photo frames.
  Export as static SVG asset from Paper — complex hand-drawn paths, not worth recreating.
- **Widget shadows**: `color(display-p3 0.608 0.657 0.681) 0px 2px 32px 4px` (wide P3 gamut soft shadow).
- **Polaroid shadows**: Dual-layer — `#5D5D5D40 0px 4px 18px 2px, #0000002E 0px 0px 4px` (distinct from widget shadow).
- **Polaroid scatter positions** (translate from origin, `transformOrigin: 0% 0%`):
  - Polaroid 1 (23.83°): translate(257.6px, -34.2px)
  - Polaroid 2 (-17.18°): translate(140.7px, 12.9px)
  - Polaroid 3 (10.45°): translate(200.9px, 45.3px)
- **Photo frame structure**: Border-radius 16px and box-shadow live on the `ShaderHalftoneCmyk` child, not the frame wrapper. Frame is just a positioning container (`position: relative`).
