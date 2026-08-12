# Health data transformation and exploratory D1 schema

Status: Proposed plan. Read-only discovery is complete; no D1 schema, migration, transform, query API, Queue, Workflow, or R2 event notification has been created.

## Goal

Create a small, durable D1 foundation that lets us build and change health visualizations quickly, without pretending that the final dashboard or analytics are known.

R2 remains the immutable private source of truth. D1 is a rebuildable query layer: normalize only broadly useful facts, perform early visualization transformations at query time, and add materialized derivations only after real charts repeat the same expensive computation.

## Working assumptions to confirm before implementation

1. The first dashboard is private and authenticated.
2. The first transform loads every numeric metric observed in metric deliveries, not only a chart shortlist.
3. R2-to-D1 starts as an idempotent manual replay/backfill; automatic event processing comes later.
4. Raw R2 objects are retained indefinitely and are never exposed to the public site.
5. Any future public visualization reads from an approved aggregate/projection, never the private canonical tables directly.
6. Workout payloads remain archived only in R2 and create no D1 rows in the first schema.

These choices maximize exploration while keeping the first implementation bounded. Changing them affects the API or transformer, but not the core fact model.

## Evidence snapshot

Read-only remote inspection at `2026-08-11T15:34:32.913Z` found:

- R2 `health-raw-data`: 90 JSON objects / 55,763,281 bytes;
- 89 `Daily sync (Minutes)` metric objects / 53,274,902 bytes;
- one `Daily workout sync (Seconds)` object / 2,488,379 bytes;
- metric envelope: `{ data: { metrics: [{ name, units, data }] } }`;
- ordinary metric rows: `{ date, qty, source }`;
- minute heart-rate rows: `{ date, Avg, Min, Max, source }`;
- bounded metric samples ranged from 7 to 25 types, spanning dense activity/cardio and sparse body, respiratory, temperature, and nutrition observations.

D1 `health-processed-data` was 24,576 bytes with no application tables or applied migrations; only Wrangler's empty internal migration table existed. The prior `2026-08-10` snapshot had 96 R2 objects; the current exact listing has 90. This audit did not cause the decrease. Reconcile retention/lifecycle behavior before treating the archive as complete.

R2 keys identify delivery lineage, not health coverage. Requested and observed-payload ranges remain separate. Workout payloads are deliberately deferred rather than forced into the regular metric model.

## Decision

Use a narrow normalized schema with two D1 layers:

```text
private R2 -> delivery/transform lineage -> general metric samples
                                         -> query-time hour/day transforms
                                         -> later reusable derivations
```

Do not create one wide column per metric while the metric set and visualizations are evolving. Workout objects remain available in R2 for a separate future design.

Do not store chart-shaped JSON in D1. Return chart-ready shapes from bounded functions over canonical numeric facts.

## Proposed D1 schema

Range-query timestamps are integer Unix milliseconds. Retain `local_date` and source UTC offset so day charts follow the day of occurrence. Quantities and counts use SQLite `REAL` because observed counts can be fractional. Normalize source strings and units without silent inference.

### 1. `raw_deliveries`

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Compact internal key |
| `object_key` | `TEXT NOT NULL UNIQUE` | Exact R2 key |
| `etag` | `TEXT` | Object version evidence |
| `automation_id` | `TEXT NOT NULL` | Delivery provenance |
| `session_id` | `TEXT NOT NULL` | Batch/session provenance |
| `ingest_id` | `TEXT NOT NULL UNIQUE` | Worker receipt UUID |
| `received_at_ms` | `INTEGER NOT NULL` | R2 receipt time |
| `size_bytes` | `INTEGER NOT NULL` | Reconciliation and sizing |
| `payload_sha256` | `TEXT` | Exact-content identity after transform |
| `requested_start_ms` / `requested_end_ms` | `INTEGER` | Only when present in payload metadata |
| `observed_start_ms` / `observed_end_ms` | `INTEGER` | Calculated from contained records |
| `record_count` | `INTEGER` | Top-level metric rows |

No personal values or raw payload fragments belong in lineage fields or logs.

### 2. `transform_runs`

| Column | Type | Purpose |
| --- | --- | --- |
| `delivery_id` | `INTEGER NOT NULL` | References `raw_deliveries` |
| `transform_version` | `INTEGER NOT NULL` | Replay/version boundary |
| `status` | `TEXT NOT NULL` | `running`, `complete`, or `failed` |
| `started_at_ms` / `completed_at_ms` | `INTEGER` | Operational timing |
| `metric_rows` / `sample_rows` | `INTEGER` | Reconciliation counts |
| `error_code` | `TEXT` | Bounded non-sensitive failure code |

Primary key: `(delivery_id, transform_version)`.

### 3. `metric_definitions`

A small catalog that prevents repeated strings and defines safe aggregation behavior.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal key |
| `code` | `TEXT NOT NULL UNIQUE` | Stable application identifier |
| `source_name` | `TEXT NOT NULL` | Observed Health Auto Export name |
| `canonical_unit` | `TEXT NOT NULL` | Unit stored in D1 |
| `value_shape` | `TEXT NOT NULL` | `scalar` or `range` |
| `rollup_method` | `TEXT NOT NULL` | `sum`, `average`, `latest`, `range`, or `none` |

`rollup_method` is reviewed metric semantics, not guessed from the unit. This prevents steps, heart
rate, weight, and VO2 max from being aggregated with the same rule.

### 4. `metric_samples`

Long-form canonical facts for the minute metrics and sparse observations.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Internal key |
| `metric_id` | `INTEGER NOT NULL` | References `metric_definitions` |
| `observed_at_ms` | `INTEGER NOT NULL` | Primary time coordinate |
| `period_start_ms` / `period_end_ms` | `INTEGER` | Preserve intervals when the source provides them |
| `local_date` | `TEXT NOT NULL` | Source-local `YYYY-MM-DD` |
| `utc_offset_minutes` | `INTEGER NOT NULL` | Preserves source offset |
| `value` | `REAL NOT NULL` | Scalar or average value |
| `value_min` / `value_max` | `REAL` | Observed range when provided |
| `source_name` | `TEXT` | Watch/phone/app provenance |
| `source_record_id` | `TEXT` | Used only when genuinely supplied |
| `semantic_key` | `TEXT NOT NULL UNIQUE` | Deterministic retry deduplication |
| `first_delivery_id` / `last_delivery_id` | `INTEGER NOT NULL` | Compact lineage |
| `seen_count` | `INTEGER NOT NULL DEFAULT 1` | Overlap/retry evidence |
| `transform_version` | `INTEGER NOT NULL` | Producer contract |

Without a stable source record ID, `semantic_key` includes observed fields including value. It deduplicates exact repeats without inventing correction/deletion semantics.

Indexes:

- `(metric_id, observed_at_ms)` for range queries;
- `(metric_id, local_date)` for local-day aggregation.

## Query and transformation strategy

The first private API exposes bounded, allowlisted query functions rather than arbitrary SQL:

- metric samples by metric code and date range;
- a requested hour/day rollup using the reviewed `rollup_method`.

The first charts should be schema probes, not a commitment to the final dashboard:

1. daily steps or activity energy tests additive rollups;
2. intraday heart rate tests averages, ranges, source provenance, and time bucketing;
3. HRV/weight/VO2 trends test sparse observations and latest-value semantics.

Do not create daily rollups or chart payload tables in the first migration. Add a derived table only when two real query paths reuse it or measured reads are too expensive.

## Delivery plan

### Phase 1: Freeze the observed contract

- Replace minimal fixtures with synthetic, non-personal replicas of the current metric shapes.
- Inventory metric names, units, row shapes, timestamp offsets, and source values across the metric corpus.
- Review the `metric_definitions` codes and rollup methods explicitly.
- Explain the 96-to-90 R2 object-count decrease and verify bucket lifecycle/retention settings.
- Estimate D1 rows and bytes from a representative week before migration approval.

Verify: every observed row shape maps to a proposed table without preserving personal payloads in the
repository.

### Phase 2: Local schema and manual transformer

- Add one reviewed local migration for the four tables and minimal indexes above.
- Implement streaming/bounded parsing and prepared D1 batches below the 100-parameter limit.
- Make replay idempotent across identical objects, overlapping exports, and transformer versions.
- Transform one representative week into local D1 first.

Verify: source counts, unique counts, per-metric counts, observed ranges, and digests reconcile with metric objects in R2; `EXPLAIN QUERY PLAN` confirms indexed range access. Workout objects create no D1 rows.

### Phase 3: Remote backfill and exploratory dashboard

- Apply the approved migration remotely as a separate explicit operation.
- Backfill retained metric objects in bounded manual batches; do not combine the corpus into one D1
  transaction or blindly parse large objects in memory.
- Add the private allowlisted range-query API and build the schema-probe charts.
- Measure D1 bytes, rows read/written, latency, and response sizes.

Verify: complete delivery reconciliation, repeatable replay with zero duplicate facts, privacy review,
and chart queries that remain bounded by date and metric.

### Phase 4: Evolve from measured visualization needs

- Adjust canonical fields only when a real chart exposes missing semantics.
- Materialize reusable daily metric derivations only after measuring repeated query cost.
- On a breaking redesign, create parallel replacement tables, replay from R2, validate both query
  paths, switch readers, and retire old tables only with explicit approval.
- Add scheduled or R2-event-driven processing only after the transform is stable and replay-safe.

## Constraints

- D1 is a private query layer, not the health-data source of truth.
- Raw health data and deferred workout payloads remain private.
- Never log health values or payload fragments.
- Use versioned migrations, prepared statements, bounded batches, and explicit indexes.
- Current D1 limits include 100 bound parameters per query, 2 MB per row/string/blob, and
  single-threaded execution; verify current limits again at implementation time.
- D1 Free is capped at 500 MB per database and Paid at 10 GB. Measured sizing determines whether all
  minute history belongs in one database; do not decide this from R2 compressed bytes alone.
- The archive ingestion response remains dependent only on the completed R2 write. Transform failures
  must never block raw retention.

## Deferred questions

- Exact correction/deletion semantics when Health Auto Export does not supply a stable record ID;
- timezone behavior during travel when only a numeric offset is present;
- the complete workout schema, identity rules, and derived analytics;
- which aggregates, if any, are approved for future public publication;
- measured D1 size of the complete transformed corpus.

## Primary references

- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 indexes: https://developers.cloudflare.com/d1/best-practices/use-indexes/
- Health Auto Export REST API: https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/
- Existing archive design: `plans/health-auto-export-pipeline.md`
