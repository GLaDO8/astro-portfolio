# Health materialized rollups and refresh

Status: Implemented locally

## Summary

Keep `metric_samples` as the canonical, lossless fact table and add one rebuildable projection table
for `day`, `week`, and `month` buckets. Daily rollups are calculated from raw facts. Weekly and
monthly rollups are calculated from daily sufficient statistics, so they never rescan minute-level
facts and never average averages.

Each rollup row stores composable state—count, sum, minimum, maximum, and the identity/value of the
latest sample—not only the displayed value. The metric's reviewed `rollup_method` determines whether
the UI reads a sum, weighted average (`sum / count`), latest value, or range.

There are three refresh paths:

1. A one-time local backfill builds history in bounded calendar chunks.
2. Every successful import recomputes only its touched metric/date buckets, then their affected
   Monday-starting weeks and calendar months, inside the same atomic import.
3. A manual bounded repair command recomputes an explicit metric/date range for future corrections
   or reconciliation.

The dashboard reads weekly rollups for high-volume activity/recovery trends and daily rollups for
sparse latest-value metrics and summaries. Sleep and medical tables stay separate. Missing periods
remain absent/null, never zero, and raw facts are not deleted.

This phase will be implemented and benchmarked against local D1 only. A later, separately approved
plan will apply the migration, backfill, query switch, and measurements to remote D1.

## Measured starting point

The completed local-first database currently contains:

- 929,905 `metric_samples` across 34 metrics from 2026-01-01 through 2026-08-13;
- 203 sleep rows and 396 medical rows, of which the dashboard selects 275;
- a current dashboard response of 1,016 rows that takes about 5.5 seconds through local Wrangler;
- a previously measured remote cold-load cost of 2,450,632 rows read, dominated by two raw-table
  scans and repeated global date bounds.

The same current facts produce only 5,216 daily, 867 weekly, and 224 monthly metric buckets: 6,307
rollup rows in total. The seven currently charted rollup metrics need 1,202 daily rows or only 201
weekly rows. This is small enough that one generic table and its primary key are sufficient.

## Design decisions

### Canonical facts and projections

- `raw_deliveries`, `metric_samples`, and `sleep_summaries` remain the source of truth.
- `metric_rollups` is disposable and completely rebuildable.
- No raw fact is deleted after a rollup is built.
- Delivery totals are never added incrementally. Overlapping exports and semantic-key deduplication
  make that unsafe; every touched bucket is recomputed from canonical facts.

### Aggregation semantics

- `sum`: display `value_sum`.
- `average`: display `value_sum / sample_count`, including when composing week/month from day.
- `latest`: select the greatest `(observed_at_ms, sample_id)` and display its value.
- `range`: display `value_sum / sample_count`, with `value_min` and `value_max` retained for range
  visualizations.
- `none`: do not materialize until the metric has a reviewed, composable operator.

Before backfill, audit all 34 definitions against the exported representation and freeze a version-1
allowlist. Mark environmental and headphone audio exposure as `none` unless their equivalent
continuous-level aggregation is implemented and tested; arithmetic dB averages are not an acceptable
fallback. Keep the existing JS definitions and SQL seed/migration values exactly equivalent in tests.

The current export is treated as HealthKit-reconciled input. Source names remain on raw facts. Version
1 has no source-specific rollups; a future comparison must use raw facts or another projection.

### Calendar and missingness

- A day bucket starts at the stored `local_date`.
- A week bucket starts on Monday in that local calendar.
- A month bucket starts on the first local calendar day.
- Do not rebucket by UTC or fixed 86,400-second intervals.
- Do not manufacture rows for missing periods and do not convert missing values to zero.
- Weekly/monthly trend queries exclude incomplete boundary buckets by default. Daily summary queries
  still expose the latest observed day.

### What remains outside this table

- Sleep remains in `sleep_summaries`: it is already daily and has only 203 rows. Weekly sleep views
  can compose those rows on read until a same-day/multi-source merge policy is reviewed.
- Medical reports remain in `medical_metrics`: 396 sparse rows do not justify another projection.
- Rolling 7/28/90-day windows are calculated from daily rollups, not materialized as overlapping
  windows.
- Workout pace curves retain workout-native resolution and do not use this table.

## Schema

Add `workers/health-ingest/migrations/health-auto-export/0003_metric_rollups.sql`.

### `metric_rollups`

```sql
CREATE TABLE metric_rollups (
  metric_id INTEGER NOT NULL REFERENCES metric_definitions(id),
  grain TEXT NOT NULL CHECK (grain IN ('day', 'week', 'month')),
  period_start TEXT NOT NULL CHECK (period_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  sample_count INTEGER NOT NULL CHECK (sample_count > 0),
  value_sum REAL NOT NULL,
  value_min REAL NOT NULL,
  value_max REAL NOT NULL,
  latest_value REAL NOT NULL,
  latest_observed_at_ms INTEGER NOT NULL,
  latest_sample_id INTEGER NOT NULL,
  aggregation_version INTEGER NOT NULL,
  PRIMARY KEY (metric_id, grain, period_start)
) STRICT, WITHOUT ROWID;
```

The primary key supports the intended query shape: an allowlisted metric set, one grain, and a bounded
period range. Add no secondary index initially. D1 bills indexed writes and index storage as well as
table writes, so new indexes require a measured query plan and rows-read benefit.

For raw rows without explicit bounds, project minimum/maximum from `value`; higher grains take the
minimum/maximum of their daily children.

### `metric_rollup_state`

Add one singleton row containing:

- `aggregation_version`;
- `status`: `needs_backfill`, `building`, or `ready`;
- `data_revision`;
- `last_complete_delivery_id`;
- `first_local_date` and `last_local_date`;
- `refreshed_at_ms`.

The migration initializes an empty database as `ready` and a database with existing facts as
`needs_backfill`. The dashboard must not silently fall back to raw scans when state is stale or the
aggregation version differs; local mode returns an actionable backfill error instead.

## Phase 1: Freeze semantics and add failing tests

Update `scripts/health/metric-definitions.mjs` and the migration seed contract so the rollup allowlist
is explicit and versioned. Add `tests/health-rollups.test.mjs` before implementation.

Test:

- every metric has one supported operator or `none`;
- SQL and JS definitions match exactly;
- sum, average, latest, and range projection from synthetic samples;
- weighted week/month averages use combined sums and counts;
- latest ties use sample ID after observation timestamp;
- Monday/week and calendar-month boundaries, including year boundaries;
- missing periods stay absent;
- unsupported metrics produce no rollup row.

## Phase 2: Add schema and local backfill

Add the migration, extend `bootstrap-local-d1.mjs` schema verification, and add
`scripts/health/refresh-health-rollups.mjs` with a local-only backfill mode:

```sh
pnpm health:rollups:backfill:local
```

Backfill behavior:

1. Refuse remote targets and require the expected migration/version.
2. Set state to `building` and clear only the rebuildable rollup table.
3. Recompute daily rows in bounded calendar-month chunks. Resolve metric IDs first so the existing
   `(metric_id, local_date)` index can perform range seeks.
4. Build all weekly and monthly rows from the completed daily layer.
5. Reconcile raw-to-day and day-to-week/month in both directions.
6. Record raw coverage and the greatest complete delivery, then set state to `ready` only after every
   check succeeds.

If interrupted, state remains non-ready and the command is safe to rerun from the beginning. Do not
serve a partially built projection.

Local integration tests use a temporary D1 and prove migration initialization, rerunnable backfill,
exact state fields, raw-fact preservation, and identical rollup content on a second backfill.

## Phase 3: Add touched-bucket incremental refresh

Add pure helpers in `scripts/health/metric-rollups.mjs` to derive distinct touched
`(metric_code, local_date)` pairs from the normalized import and generate bounded, set-based SQL.

Extend `buildSql()` in `import-health-auto-export.mjs` so a new delivery performs this order inside its
already proven atomic file execution:

1. Insert the pending delivery and deduplicated raw facts.
2. Recompute/upsert touched daily buckets from `metric_samples`.
3. Recompute/upsert the distinct affected Monday weeks from daily rows.
4. Recompute/upsert the distinct affected calendar months from daily rows.
5. Advance rollup state/revision without changing a non-ready backfill status.
6. Mark the delivery complete last.

Guard refresh statements on the delivery still being `pending`, so an exact replay performs no
rollup work. Add `DO UPDATE ... WHERE` comparisons so overlap-only buckets are not rewritten when the
composable state did not change.

Extend local reconciliation to compare every touched daily/weekly/monthly row with a fresh canonical
calculation. Extend the existing late-conflict atomicity test to prove raw facts, rollups, state, and
delivery status all roll back together.

Also support late historical arrivals: importing a fact for an old date must change exactly its day,
week, and month while leaving unrelated buckets byte-for-byte unchanged.

## Phase 4: Add bounded manual repair

Use the same projector in a separate local-only operator command:

```sh
pnpm health:rollups:refresh:local -- --start YYYY-MM-DD --end YYYY-MM-DD
pnpm health:rollups:refresh:local -- --metric step_count --start YYYY-MM-DD --end YYYY-MM-DD
```

Require an explicit inclusive date range, validate metric codes against the allowlist, recompute day
buckets from raw facts, and recompute every intersecting week/month. Delete a selected bucket if its
canonical source is now empty, which makes this path suitable for future corrections/deletions.

The command must be idempotent, local by default, incapable of selecting remote, and value-free in
logs. Report only bucket counts, range, version, duration, and reconciliation status.

## Phase 5: Switch the dashboard read path

Replace the raw activity/recovery queries and raw VO2/weight windows in
`src/dev/health/healthDevIntegration.mjs` with an allowlisted rollup query helper.

- Activity and recovery trend series default to complete Monday-starting weeks.
- VO2 max and weight stay at sparse daily grain so their real observation dates are not shifted to a
  period boundary.
- Summary cards use daily rollups and explicitly describe their period.
- Apple Health coverage comes from ready rollup state plus sleep coverage, not global raw bounds.
- Sleep and medical queries remain unchanged.
- Remove the recursive SQL date spines; the UI receives sparse rows and preserves gaps.
- Remove the client-side `rollUpWeeklyExerciseTime()` step once exercise time arrives weekly.
- Update labels such as “Daily step count” and “Latest steps” so they match the returned grain.

Keep the endpoint response private, dev-only, `no-store`, and free of Wrangler metadata. Add a response
field identifying the aggregation version/grain, not database paths or IDs.

Query-plan tests must show primary-key range searches on `metric_rollups` and no `metric_samples` scan
for activity, recovery, VO2 max, or weight. A local endpoint benchmark records duration, result rows,
and per-statement metadata before and after.

## Phase 6: Verification and documentation

Update:

- `package.json` with local backfill and bounded-refresh commands;
- `scripts/verify-changed.mjs` so migration, projector, importer, and dashboard changes select the
  rollup and local-D1 integration suites;
- `workers/health-ingest/README.md` with normal import/refresh behavior, rebuild/repair commands, and
  the local-only boundary;
- `workers/health-ingest/migrations/README.md` with migration order and remote deferral;
- `plans/local-d1-first-migration.md` only to link this successor plan from its completed status.

Run:

```sh
pnpm exec node --test tests/health-rollups.test.mjs tests/health-d1-local.test.mjs tests/health-dashboard-dev.test.mjs
pnpm health:transform:test
pnpm run verify:changed
pnpm health:verify
pnpm run build:astro
git status --short
```

Browser verification checks weekly/daily labels, latest summary values, missing gaps, incomplete
boundary exclusion, a late local import appearing after reload, and production exclusion of `/health`
and `/__dev/health-data`.

## Acceptance criteria

- Raw fact, sleep, medical, and delivery counts do not change during migration/backfill.
- Version-1 rollup semantics are explicit; unsupported sound-level metrics are not averaged naively.
- Daily rows reconcile to raw facts; weekly/monthly rows reconcile to daily sufficient statistics.
- Averages are weighted by raw sample count, not by the number of child periods.
- Import refresh touches only affected day/week/month buckets and commits atomically with facts.
- Exact replay and unchanged overlaps do not rewrite rollup rows.
- Late historical imports and bounded repair update the correct historical buckets.
- Non-ready or version-mismatched state never triggers a silent raw-query fallback.
- The dashboard performs no raw `metric_samples` scan for its rollup-backed panels.
- The current seven chart metrics read roughly hundreds of rollup rows rather than millions of raw
  rows; exact before/after evidence is recorded.
- Automated tests and normal development make no remote D1 calls or mutations.
- No private values, local SQLite files, or generated SQL appear in Git or logs.
- Production still contains no health route or data endpoint.

## Remote promotion is a separate gate

Do not apply `0003`, backfill remote D1, switch any deployed reader, or run remote reconciliation in
this phase. After local approval, a short promotion plan must snapshot remote state/usage, apply only
the reviewed migration, backfill bounded chunks while recording query metadata, verify without a
second unnecessary full scan, switch only at `ready`, and retain a manual raw-path rollback.

Current D1 pricing includes 25 billion rows read, 50 million rows written, and 5 GB on Workers Paid;
rows scanned are billed even when few rows are returned, and indexes add billed writes/storage. The
design therefore uses one small primary-keyed projection and no speculative indexes.

## Local implementation evidence

Implemented on 2026-08-15 without remote D1 access or mutation.

- Migration `0003` and the version-1 allowlist were applied to local D1 only. The two sound-level
  metrics are `none` and do not produce rows.
- The local backfill reconciled 929,905 metric facts into 4,830 daily, 804 weekly, and 209 monthly
  supported rollups in 298 seconds. The 16 delivery, 929,905 metric-sample, 203 sleep, and 396
  medical-row counts were unchanged.
- A bounded one-day `step_count` repair reconciled in 16 seconds and logged no health values.
- The combined local dashboard query returned 630 rows in about 3.5 seconds through Wrangler. The
  measured starting query returned 1,016 rows in about 5.5 seconds. Local statement metadata was
  0–3 ms per statement; Wrangler process startup now dominates the remaining request duration.
- Query-plan integration tests use primary-key searches on `metric_rollups` and reject
  `metric_samples` scans for activity, recovery, VO2 max, and weight.
- Browser verification showed 31 complete weekly activity/recovery points, sparse daily VO2 max and
  weight gaps, correct daily/weekly labels, and no horizontal overflow at 390 px. The production
  build contained no health route, endpoint, query, or schema reference.

## References

[Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), and [migrations](https://developers.cloudflare.com/d1/reference/migrations/); [Apple HealthKit statistics](https://developer.apple.com/documentation/healthkit/executing-statistics-collection-queries); [OpenTelemetry's metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/); and Timescale's [hierarchical aggregates](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/hierarchical-continuous-aggregates/) and [refresh policies](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/refresh-policies/).
