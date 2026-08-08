# Health transformation and analytics pipeline

Status: Architecture researched. No D1 schema, Queue, Workflow, R2 notification, transform, or query
API has been provisioned. The schema remains provisional until representative Health Auto Export v2
metric and workout envelopes are captured as synthetic fixtures.

## Decision

Use a hybrid query model:

1. R2 remains the immutable source of truth.
2. D1 stores canonical observations and workouts at their useful natural grain.
3. Reusable daily and workout-level derivations are computed once and versioned.
4. Dashboard endpoints compose arbitrary date ranges from canonical facts and reusable derivations.
5. Complete chart payloads are not precomputed for every possible date range.

This keeps the dashboard flexible without recalculating expensive workout analytics on every read.

## Architecture

```text
Health Auto Export
        |
        v
archive-only ingestion Worker
        |
        v
immutable R2 object ------------------------------+
        |                                          |
        | object-create notification               | replay/backfill
        v                                          v
      Queue ------------------------------> transform Workflow
                                                   |
                                     parse + normalize + deduplicate
                                                   |
                                                   v
                                          canonical D1 facts
                                                   |
                                      reusable derived calculations
                                                   |
                                                   v
                                          private query API
                                                   |
                                                   v
                                              dashboard
```

The ingestion response continues to depend only on the R2 archive write. Parsing and D1 failures
must never prevent raw evidence from being retained.

## Visualization computation boundary

| Visualization | Canonical source | Query or precompute |
| --- | --- | --- |
| Workout contribution calendar | workouts | Query by local workout date |
| Step-count graph | daily metric rollups | Precompute daily sum; query ranges |
| VO2 max graph | metric observations | Query sparse observations directly |
| Weight graph | metric observations | Query sparse observations directly |
| Body-fat graph | metric observations | Query sparse observations directly |
| HRV graph | observations or daily rollups | Query observations; optionally expose daily aggregate |
| Workout pace time series | workout minutes | Query minute samples directly |
| Time in HR zones | workout minutes + zone profile | Precompute versioned per-workout zone totals |
| Pace-to-HR curve | workout minutes | Query initially; materialize bins only if measured reads are slow |
| Aerobic decoupling | workout minutes | Precompute per workout with an algorithm version |
| Pace curve | workout minutes | Define the chart first; precompute only if it means rolling best-effort points |
| Exercise PRs | future Bevel exercise sets | Separate future schema; do not add placeholder workout columns |

Precomputed data should remain reusable analytic facts, not presentation-specific JSON. A chart can
therefore change its date range, dimensions, or rendering without requiring a new transformation.

## Provisional D1 model

The exact columns and record identity rules must be confirmed against real version 2 envelopes.

### Processing and lineage

`raw_objects`

- R2 object key and eTag;
- ingest ID, byte size, received time, and source metadata;
- first-seen and latest processing status.

`transform_runs`

- raw object key;
- transform version;
- status, attempts, started/completed times, and bounded error code;
- unique key on `(raw_object_key, transform_version)`.

Workflow state and Queue delivery history are operational signals, not durable lineage. D1 records
the processing outcome because Workflow history has limited retention.

### Metric facts

`metric_definitions`

- canonical metric code;
- canonical unit;
- semantic rollup policy such as sum, average, or latest;
- display metadata only when shared across queries.

`metric_observations`

- stable source identity or deterministic semantic hash;
- metric code;
- observation start/end in UTC;
- local date and source offset/timezone;
- normalized numeric value and canonical unit;
- source/device fields only when present and useful;
- source raw-object reference and transform version.

Primary query index: `(metric_code, observed_at)`.

`daily_metric_rollups`

- local date and metric code;
- sum, average, minimum, maximum, latest value, and sample count as applicable;
- rollup and transform versions;
- primary key on `(metric_code, local_date, rollup_version)`.

Daily buckets make arbitrary dashboard ranges cheap while raw observations remain available for
sparse metrics and future analysis.

### Workout facts

`workouts`

- stable source workout identity;
- activity type, start/end in UTC, local date and timezone/offset;
- duration, distance, energy, and source-provided workout summaries;
- source raw-object reference and transform version.

Indexes: `(started_at)` and `(activity_type, started_at)`.

`workout_minutes`

- workout identity and minute index/start time;
- broadly reusable telemetry such as heart rate, pace/speed, and distance delta;
- nullable typed columns only for telemetry shared by multiple analytics;
- primary key on `(workout_id, minute_index)`.

Minute buckets are the canonical analysis grain for running and interval workouts. Strength
training remains a workout without fabricated pace or heart-rate columns.

### Versioned derivations

`hr_zone_profiles`

- effective date range;
- method and zone thresholds;
- version.

`workout_hr_zone_totals`

- workout, zone-profile version, zone, seconds/minutes, and percentage.

`workout_derived_metrics`

- workout;
- metric or algorithm name;
- algorithm version;
- numeric result and bounded parameters needed to interpret it.

Aerobic decoupling must define pause handling, warm-up exclusion, split method, and pace/HR validity
before implementation. Changing a formula creates a new version and replay, not destructive updates.

Future Bevel strength data should use separate `exercise_sets` and `exercise_prs` tables once its
source contract is known.

## Identity, overlap, and replay

- Queue delivery is at-least-once and unordered; every write must be idempotent.
- A raw ingest UUID proves a delivery is unique but does not prove its health records are unique.
- Prefer stable Health Auto Export or HealthKit record IDs when the envelope provides them.
- Otherwise derive a deterministic semantic key from metric/workout type, timestamps, source, unit,
  and value fields confirmed by contract capture.
- Repeated monthly exports and Since Last Sync overlap must upsert rather than duplicate facts.
- R2 is retained indefinitely, so D1 can be rebuilt when schemas or algorithms change.
- Backfill all existing objects before enabling the R2 object-create notification for new objects.

## Processing strategy

Use one Queue and one Workflow type:

1. R2 object-create sends only object key, eTag, and size to the Queue.
2. The Queue consumer starts a deterministic Workflow for object key plus transform version.
3. The Workflow claims `transform_runs`, reads R2, parses the envelope, and writes bounded D1 batches.
4. Stable reusable derivations run after canonical facts commit.
5. The Workflow marks the durable D1 run complete; failures remain replayable.

For the retained corpus, an authenticated operator action lists both legacy-prefixed and flat R2
keys and starts Workflows in bounded batches. Do not depend on notifications for old objects.

Large JSON objects should not be blindly loaded with `JSON.parse`. Workers have 128 MB of memory and
JSON can expand several times beyond its wire size. Use smaller source exports initially and evaluate
a streaming JSON parser against representative fixtures before transforming large objects.

D1 writes should use prepared statements, indexes for date/filter access, and small transactional
`batch()` calls. A complete monthly backfill must not be one transaction. Measure query plans and
`rows_read`/`rows_written` before tuning batch size.

## Export profile for the 2026 backfill

Do not use one unsummarized automation for every metric.

### High-volume daily trends

- Step count and similar activity totals;
- Summarise Data: on;
- Time Grouping: days;
- JSON version 2 and Batch Requests: on.

Daily aggregation preserves the grain required by the listed charts while sharply reducing device
query and encoding pressure.

### Sparse body and cardiovascular observations

- VO2 max, weight, and body-fat percentage;
- Summarise Data: off initially;
- keep this automation small because these observations are naturally sparse.

HRV can join this group for a first test. If it remains too large, export HRV separately or accept a
daily summary if intraday HRV analysis is not needed.

### Workouts

- Separate workout automation;
- workout metrics: included;
- workout metric grouping: minutes;
- route/GPX data: off initially;
- JSON version 2 and Batch Requests: on.

Minute workout telemetry supports HR-zone, pace-to-HR, and decoupling analysis with less noise and
volume than per-second data.

### Backfill ranges

Start detailed exports with seven-day custom ranges. Increase to fourteen days only after repeated
successful runs. Summary and sparse-metric exports may tolerate a month, but reliability is more
important than minimizing the number of manual exports.

The Worker accepts up to 90 MiB after the August 2026 limit revision. That solves the observed 25 MiB
application rejection but does not remove iPhone memory/time constraints, so smaller purpose-specific
exports remain necessary.

## Delivery phases

### Phase 1: Contract capture and measured sizing

- Capture representative metrics and workout envelopes without committing personal data.
- Replace minimal fixtures with synthetic envelopes matching observed version 2 structures.
- Confirm record IDs, timestamps, units, corrections, sources, and workout-minute shapes.
- Measure rows and estimated D1 bytes from one representative week/month.
- Define HR zones, pace curve, and decoupling algorithms precisely.

### Phase 2: Canonical D1 transformation

- Add reviewed migrations for lineage, metric facts, workouts, and workout minutes.
- Implement idempotent parsing, normalization, unit handling, and bounded D1 writes.
- Add replay tests for overlaps, retries, corrections, malformed objects, and transform upgrades.
- Backfill retained R2 objects and reconcile counts before enabling new-object processing.

### Phase 3: Derived analytics and private queries

- Add daily metric rollups and versioned workout derivations.
- Add authenticated, bounded query endpoints for chart-ready ranges.
- Verify indexes with `EXPLAIN QUERY PLAN` and measure real response sizes/latency.
- Add materialized pace-to-HR bins only if measured query performance requires them.

### Phase 4: Dashboard and future sources

- Build the evolving dashboard against private range-query contracts.
- Add Bevel ingestion and exercise/PR tables only after its source contract is captured.

## Current unknowns

- Exact Health Auto Export v2 source record IDs and correction/deletion behavior;
- whether multiple selected metrics remain disaggregated when Summarise Data is off—the official
  documentation is inconsistent and needs contract capture;
- local-day behavior while travelling across timezones;
- exact HR-zone definition and effective-date behavior;
- whether pace curve means a workout pace time series or rolling best-effort curve;
- pause and validity rules for aerobic decoupling;
- current Cloudflare plan and measured D1 size for representative data.

## Primary references

- Health Auto Export REST API: https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/
- Health Auto Export automation performance: https://help.healthyapps.dev/en/health-auto-export/automations/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 indexes: https://developers.cloudflare.com/d1/best-practices/use-indexes/
- Cloudflare R2 event notifications: https://developers.cloudflare.com/r2/buckets/event-notifications/
- Cloudflare Queue delivery guarantees: https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- Cloudflare Workflows limits: https://developers.cloudflare.com/workflows/reference/limits/
