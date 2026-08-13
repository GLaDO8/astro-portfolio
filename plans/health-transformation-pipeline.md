# Health Auto Export to D1 implementation plan

Status: Implemented, migrated, and backfilled on August 13, 2026. The 13 selected JSON exports remain archived unchanged and hash-verified in private R2. Production D1 reconciles exactly with the verified local corpus.

## Outcome

```text
immutable JSON in private R2
             -> local validation and normalization
             -> four canonical D1 tables
             -> date-bounded visualization queries
```

The archive Worker stays unchanged and archive-only. Transformation failure must never affect R2 retention or webhook ingestion.

## Confirmed source contract

- 13 JSON objects / 146,378,416 bytes;
- 827,007 rows across 34 metric name/unit pairs;
- 772,011 scalar rows, 54,817 heart-rate range rows, and 179 sleep summaries;
- no parse failures, invalid timestamps/numbers, duplicate payloads, or exact duplicate metric rows;
- observed dates from January 1 through July 31, 2026;
- no April 16-30 export; April 30 appears only as a boundary row in the May export;
- no workout records.

The April gap remains visible as missing data until another export supplies it. It does not block implementation.

## Phase 1 schema

Use four tables only. Do not add transform-run history, daily rollups, workout placeholders, chart JSON, or generic key-value fields.

### `raw_deliveries`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal identifier |
| `object_key` | `TEXT NOT NULL UNIQUE` | Exact R2 key |
| `payload_sha256` | `TEXT NOT NULL UNIQUE` | Exact content identity |
| `received_at_ms` | `INTEGER NOT NULL` | R2 receipt time |
| `observed_start_ms` | `INTEGER NOT NULL` | Earliest contained timestamp |
| `observed_end_ms` | `INTEGER NOT NULL` | Latest contained timestamp |
| `transform_status` | `TEXT NOT NULL` | `pending`, `complete`, or `failed` |

A previously completed hash is a no-op. For a new file, insert `pending`, write and reconcile facts, then set `complete` inside one source-file SQL transaction. Failure rolls back the delivery and its facts; aggregate-only diagnostics carry the failure reason.

### `metric_definitions`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal identifier |
| `code` | `TEXT NOT NULL UNIQUE` | Stable application code |
| `unit` | `TEXT NOT NULL` | Reviewed observed unit |
| `rollup_method` | `TEXT NOT NULL` | `sum`, `average`, `latest`, `range`, or `none` |

Seed the 33 observed non-sleep metrics. Unknown names, unit drift, or changed row shapes fail validation instead of being accepted silently.

### `metric_samples`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal identifier |
| `delivery_id` | `INTEGER NOT NULL` | First delivery that inserted the fact |
| `metric_id` | `INTEGER NOT NULL` | References `metric_definitions` |
| `observed_at_ms` | `INTEGER NOT NULL` | Original instant, unchanged |
| `local_date` | `TEXT NOT NULL` | Visualization day after metric-specific rules |
| `utc_offset_minutes` | `INTEGER NOT NULL` | Supplied offset |
| `value` | `REAL NOT NULL` | Scalar value or heart-rate average |
| `value_min` / `value_max` | `REAL` | Heart-rate bounds; otherwise `NULL` |
| `source_name` | `TEXT` | Original source or `NULL` |
| `semantic_key` | `TEXT NOT NULL UNIQUE` | Deterministic exact-fact identity |

Indexes: `(metric_id, observed_at_ms)` and `(metric_id, local_date)`.

The semantic key hashes metric code, unit, original timestamp/offset, numeric fields, and source. Exact overlaps are ignored idempotently. A different value for the same logical daily key is a conflict; never average or silently overwrite it.

### `sleep_summaries`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal identifier |
| `delivery_id` | `INTEGER NOT NULL` | First delivery that inserted the fact |
| `local_date` | `TEXT NOT NULL` | Source-local summary day |
| `sleep_start_ms` / `sleep_end_ms` | `INTEGER` | `NULL` when absent |
| `total_sleep_hours` | `REAL` | `NULL` when absent |
| `awake_hours` | `REAL` | `NULL` when absent |
| `core_hours` / `deep_hours` / `rem_hours` | `REAL` | `NULL` when absent |
| `source_name` | `TEXT` | Original source or `NULL` |
| `semantic_key` | `TEXT NOT NULL UNIQUE` | Deterministic exact-summary identity |

Index `(local_date)`. Never infer zero for a missing sleep stage or missing night.

## Missing-data contract

Two cases must remain distinct:

1. A present record lacks an optional field: store SQL `NULL` in that column.
2. No record exists for a requested day: store no placeholder fact. The query creates the requested date spine and `LEFT JOIN`s facts or rollups, so the value is naturally `NULL`.

Never use `COALESCE(value, 0)` for measurements. Charts render `NULL` as a gap or explicit missing state.

```sql
WITH RECURSIVE dates(local_date) AS (
  VALUES (?1)
  UNION ALL SELECT date(local_date, '+1 day')
  FROM dates WHERE local_date < ?2
), daily AS (
  SELECT local_date, SUM(value) AS value
  FROM metric_samples
  WHERE metric_id = ?3 AND local_date BETWEEN ?1 AND ?2
  GROUP BY local_date
)
SELECT dates.local_date, daily.value
FROM dates LEFT JOIN daily USING (local_date)
ORDER BY dates.local_date;
```

The allowlisted query function chooses the reviewed aggregation method; callers cannot submit SQL.

## Wrist-temperature normalization

The 13 exports contain 163 sleeping wrist-temperature rows, with zero exact duplicates or duplicate timestamps. The apparent overlap is a nocturnal date-boundary effect: one raw calendar date contains an after-midnight reading and a late-evening reading for different sleep days.

Preserve every value and `observed_at_ms`. Change only this metric's derived `local_date`, using its supplied offset:

```text
local time before 12:00   -> same local calendar date
local time at/after 12:00 -> following local calendar date
```

This maps all 163 readings inside their requested export ranges and gives 163 unique wake dates. Exact repeated key/value pairs are no-ops. Same normalized metric/day/source with a different value stops the delivery as a conflict.

## Repository changes

Add:

```text
scripts/health/metric-definitions.mjs
scripts/health/normalize-health-auto-export.mjs
scripts/health/import-health-auto-export.mjs
tests/health-auto-export-transform.test.mjs
tests/fixtures/health-auto-export/{scalar,range,sleep,temperature-boundary}.json
workers/health-ingest/migrations/health-auto-export/0001_health_auto_export.sql
```

Update `wrangler.jsonc`, the Worker and migration READMEs, `package.json`, `scripts/verify-changed.mjs`, and this plan. Do not change `workers/health-ingest/src/index.ts` or its ingestion tests.

### Migration isolation

An unrelated untracked `workers/health-ingest/migrations/0001_medical_metrics.sql` currently exists. The present commands would apply it accidentally. Point the binding's active `migrations_dir` to `workers/health-ingest/migrations/health-auto-export`, leave the medical file untouched, and create the health migration there. Before remote apply, confirm that `wrangler d1 migrations list ... --remote` shows only the reviewed health migration.

## Local pipeline

The pure normalizer validates known envelopes/shapes, parses numeric offsets, preserves instants and sources, applies only the temperature wake-date rule, maps absent optional fields to `null`, and produces semantic keys plus aggregate reconciliation metadata.

The importer processes one exact file or R2 object at a time:

- default mode is dry-run;
- `--local` writes an isolated local D1 store;
- `--remote` additionally requires the configured database ID `7f570a9a-fab7-4f17-a69a-c7717320802f`;
- write bounded statements inside one per-file SQL transaction using `wrangler d1 execute --file`;
- use a mode-`0700` temporary directory and mode-`0600` SQL file, deleted in `finally`;
- never place health values in command arguments or logs;
- stop on the first validation, write, or reconciliation mismatch;
- log only object/file identifiers, hashes, counts, ranges, timings, and bounded error codes.

Use the explicit 13-file manifest. Never glob Downloads because an extra unselected full-January export exists.

## Verification gates

Local verification result: Gates 1–3 passed. The explicit corpus produced 13 complete deliveries,
826,828 metric samples, 179 sleep summaries, 33 seeded definitions, and 163/163 unique normalized
wrist-temperature wake dates. Replay added zero facts; foreign-key checks were empty; both metric
indexes were used; the April 16–29 date spine returned 14 `NULL` days. During corpus validation,
three heart-rate rows had rounded averages just outside their reported min/max bounds, so validation
correctly enforces finite `Avg`/`Min`/`Max` and `Min <= Max` without inventing a tighter source rule.

Remote verification result: Gates 4–5 passed after explicit approval. The isolated migration added
only the reviewed health schema and left `medical_metrics` intact. Production contains 13 unique,
complete delivery hashes, 826,828 metric samples, 179 sleep summaries, 33 definitions, and 163/163
unique wrist-temperature wake dates. A replay added zero facts; `PRAGMA foreign_key_check` was empty;
both range-query indexes were selected; and the April 16–29 date spine returned 14 `NULL` days.

### Gate 1: Pure normalization

- Add synthetic fixtures only; never commit personal values.
- Test scalar, range, sleep, offsets, missing fields, unknown metrics, unit drift, and invalid envelopes.
- Test 23:00 -> next day, 00:06 -> same day, month boundaries, replay, and conflicting daily values.
- Dry-run the explicit 13 files.

Exit: 827,007 rows accepted; 826,828 target `metric_samples`; 179 target `sleep_summaries`; 163/163 temperature rows retained with unique wake dates; no unexpected contract variants.

### Gate 2: Local representative import

- Apply the isolated migration to a fresh local store.
- Import one representative file, replay it, then import its adjacent overlapping file.
- Test a date spine containing present and absent days.

Exit: replay adds zero facts; missing fields/days return `NULL`; counts reconcile; `PRAGMA foreign_key_check` is empty; `EXPLAIN QUERY PLAN` uses both indexes; no private values remain in arguments, logs, fixtures, or temp files.

### Gate 3: Full local corpus

- Import all 13 files one at a time into a fresh local store, then replay all 13.
- Compare hashes, counts, metric counts, sleep counts, and ranges with the R2 audit.

Exit: 13 complete deliveries; 826,828 unique non-sleep facts and 179 sleep summaries unless exact cross-file repeats are separately reported; replay adds zero; April 16-29 is `NULL`; all reconciliations pass.

### Gate 4: Remote migration approval

Read-only list the remote migrations and schema, confirm the database name/ID, present the exact SQL and expected tables/indexes, then obtain explicit approval. Apply only the isolated health migration. Cloudflare records applied migrations and takes a backup, but local gates remain mandatory.

### Gate 5: Remote backfill

Import and reconcile one archived object first. Continue one object at a time only while checks pass; stop on any mismatch. After all 13, replay one object.

Exit: remote counts/ranges equal local; all 13 hashes appear once in `raw_deliveries`; foreign keys and indexed plans pass; absent observations return `NULL`; R2 remains unchanged and private.

## Commands

```sh
pnpm exec node --test tests/health-auto-export-transform.test.mjs
pnpm health:transform:dry -- <exact paths>
pnpm health:db:migrate:local
pnpm health:transform:local -- <exact paths>

pnpm exec wrangler d1 migrations list health-processed-data --config workers/health-ingest/wrangler.jsonc --remote
pnpm health:db:migrate:remote
pnpm health:transform:remote -- --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f <exact paths>
```

Run `pnpm health:verify` after implementation to prove the archive Worker still passes. Personal-data backfills must not become part of that general verification command.

## Deferred

Workouts; R2 events/Queues/Workflows/Cron; public health APIs; materialized daily rollups; source normalization; inferred April data; correction/deletion semantics beyond exact-repeat detection and explicit conflicts.

## References

- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Raw archive contract: `plans/health-auto-export-pipeline.md`
