# Health reference ranges and derived charts

1. Inventory the medical-report folder and remove only byte-identical duplicate files.
   - Verify: each remaining file has a unique SHA-256 digest.
2. Extract the reference intervals printed by each source lab and compare them with the existing metric glossary and authoritative general guidance.
   - Verify: every charted medical metric has either explicit bands or a documented source-lab/trend-only fallback.
3. Add a small typed reference-band module for charting without changing stored medical observations.
   - Verify: unit matching, open-ended bands, labels, and metric coverage have focused tests.
4. Add only derived Apple Health views supported by the local D1 schema, and remove the unavailable pace curve.
   - Verify: SQL stays read-only and rollup-backed where applicable; missing observations remain missing.
5. Run focused tests, changed-file verification, the Astro production build, and browser DOM checks on `/health`.
   - Verify: charts render without overflow and the private health route remains excluded from production output.
