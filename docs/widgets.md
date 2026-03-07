# Widget Specifications

## Widget Strip

Horizontally scrollable section spanning viewport width. Contains interactive widget cards.
Scrolled via Lenis (`orientation: 'horizontal'`, `gestureOrientation: 'both'`).

Lenis velocity is read per-frame and distributed to widgets as a normalized signal.

## Widgets (from Paper latest frame 3D-0)

### Photo Frame (x2)
- 300x200px, rounded-16
- Photo with halftone CMYK dot shader
- Post-it note SVG ("Me!") — positioned at left:216px, top:127px (overflows frame)
  - Export from Paper as static SVG asset (complex hand-drawn paths)
- **Interactions:**
  - Post-it flutters with mouse velocity (rotateY spring)
  - Post-it lifts on hover (translateZ spring)
  - Post-it sways with scroll velocity
  - Photo frame tilts subtly on hover (perspective + rotateX/Y)

### Snaps
- 300x200px, rounded-16, `#bdda7d` green background
- Title: "Snaps" (Inter Variable Bold 30px)
- Camera list: "Fuji X100V / iPhone / Kodak Charmera" (Inter Variable, green dark text)
- 3 instant photos (96x120px each) scattered at different rotations
- **Interactions:**
  - Polaroids fan out on hover (staggered rotation springs)
  - Polaroids shuffle/shift on scroll velocity
  - Photo shadows improve with lift (dynamic shadow spring)

### Music Widget (from previous iteration, node 80-0) — NOT in Phase 1
> Not present in current frame `3D-0`. Preserved here for future reference.

- 300x200px, rounded-16, white background
- "WEEKLY OBSESSIONS" label (green), "Air" (bold), "Modular Mix" (medium)
- Vinyl record with tonearm
- **Interactions:**
  - Record rotates continuously (slow idle spin)
  - Cursor drag scratches the record (drag -> rotation spring)
  - Tonearm follows with spring (higher stiffness, snappy)
  - Speech bubble appears on hover

## Signal -> Widget Mapping

| Signal | Post-it | Photo Frame | Polaroids |
|--------|---------|-------------|-----------|
| Scroll velocity | `rotateY` sway | subtle tilt | shuffle shift |
| Mouse velocity | `rotateY` flutter, lift | - | - |
| Hover | fold corner, lift | tilt (perspective) | fan out |

> Vinyl/Tonearm signal mapping deferred to Phase 2+ (music widget).

## Spring Parameters (starting points — tune with debug overlay)

| Element | Stiffness | Damping | Mass | Notes |
|---------|-----------|---------|------|-------|
| Post-it tilt | 100 | 10 | 1 | Floppy, slow settle |
| Post-it lift | 150 | 15 | 1 | Medium response |
| Tonearm | 250 | 20 | 1 | Snappy, precise |
| Polaroid fan | 180 | 12 | 1 | Staggered delay between cards |
| Photo tilt | 120 | 18 | 1 | Subtle, dampened |
