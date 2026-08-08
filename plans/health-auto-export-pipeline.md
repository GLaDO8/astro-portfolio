# Health Auto Export raw ingestion

Status: Phase 1 implemented and verified. The archive-only Worker is deployed; manual Health Auto
Export contract capture remains pending before scheduled syncing is enabled.

## Outcome

Build a private Cloudflare Worker endpoint that receives Health Auto Export JSON requests and stores
each original request unchanged in R2.

The first release supports two Health Auto Export automations:

1. health metrics;
2. workouts.

Raw objects are retained indefinitely. D1 transformation, normalized schemas, Queues, Workflows,
and query APIs are explicitly deferred.

Health Auto Export pushes data to the Worker with HTTP `POST`; the Worker does not fetch from it.

## Current baseline

The repository already has a standalone Worker under `workers/health-ingest/`, separate from the
static Astro site.

- `GET /health` checks the existing `HEALTH_RAW` R2 and `HEALTH_DB` D1 bindings.
- R2 bucket `health-raw-data` contains the initial manual export objects.
- D1 database `health-processed-data` exists but remains unused in this phase.
- `HEALTH_INGEST_TOKEN` is configured as a production Worker secret and authenticates ingestion.
- The Worker is deployed at `https://health-ingest.glado8.workers.dev`.
- Structured, payload-free Worker logs are enabled in Cloudflare Observability.

## Active architecture

```text
Health Auto Export: Metrics automation ----+
                                           |
Health Auto Export: Workouts automation ---+--> HTTPS POST
                                                   |
                                                   v
                                           health-ingest Worker
                                           - authenticate
                                           - validate request metadata
                                           - enforce size limit
                                           - stream unchanged body
                                                   |
                                                   v
                                           private R2 bucket
                                           flat immutable objects
```

The HTTP request is successful only after the R2 write resolves. There is no asynchronous processing
stage in the active scope.

## Health Auto Export configuration

Create separate REST API automations for Metrics and Workouts because each automation selects its own
data type and export settings.

Use these initial settings:

- Format: JSON.
- Export version: version 2.
- Date range: Since Last Sync.
- Batch Requests: enabled.
- Endpoint: the same Worker ingestion URL for both automations.
- Authentication: the same dedicated bearer token initially.
- Metrics: select only metrics we expect to use later; avoid exporting every available empty metric.
- Workouts: begin without second-level workout metrics or route data unless those details are needed.

Batching is important because Health Auto Export can produce very large requests. The Worker
application limit is 90 MiB per request, below Cloudflare's 100 MB Free/Pro platform limit. The
limit was raised after the first unsummarized backfill produced repeated `413` responses around the
original 25 MiB ceiling.

## Ingress contract

### Endpoint

`POST /v1/ingest/health-auto-export`

Retain the existing `GET /health` endpoint.

### Required headers

- `Authorization: Bearer <HEALTH_INGEST_TOKEN>`
- `Content-Type: application/json`
- `automation-id`
- `session-id`

Capture as bounded R2 metadata when present:

- `automation-name`
- `automation-aggregation`
- `automation-period`
- `Content-Encoding`
- Worker-generated `ingest_id` and `received_at`

Health Auto Export documents `session-id` as unique per request, not per complete automation run. Do
not infer batch ordering or group requests into a run.

### Request handling

1. Match only the exact route and `POST` method.
2. Compare the bearer token using a constant-time digest comparison.
3. Require the source headers and JSON content type.
4. Reject requests over 90 MiB. Enforce the ceiling while streaming rather than trusting only
   `Content-Length`.
5. Generate a UUID ingest ID and sanitize all header-derived key segments.
6. Stream the original request body directly into R2 without parsing, transforming, or logging it.
7. Return success only after `HEALTH_RAW.put()` resolves.
8. Return a small `no-store` response containing `ingest_id`, `raw_key`, and `status: "archived"`.

Start with HTTP `200` because HealthyApps does not document whether every `2xx` status is accepted.
Return `401`, `405`, `413`, `415`, or `5xx` for their corresponding failures.

## R2 object contract

Object key:

```text
<received-at>-<automation-id>-<session-id>-<ingest-id>.json
```

Properties:

- Objects are stored at the bucket root without virtual directory prefixes.
- Two objects captured before the flat-key deployment retain their original dated-prefix keys.
- The Worker-generated UUID makes every delivery immutable; repeated requests never overwrite raw
  evidence.
- The original body bytes are retained unchanged.
- R2 custom metadata contains only bounded request metadata, never duplicated health values.
- The bucket remains private and is accessed through the Worker binding.
- No lifecycle expiration rule is configured. Retention is indefinite until a future explicit,
  reviewed deletion policy replaces it.
- No production logs contain request bodies, metric values, workout details, or GPS coordinates.

Because retention is indefinite, monitor object count and stored bytes. Storage growth is an
operational signal, not an automatic deletion trigger.

## Contract-capture checks

HealthyApps does not document retry rules, batch indices, success-response semantics, compression,
or whether Since Last Sync advances after HTTP failures. After the archive-only endpoint is deployed:

1. Send one small manual metrics export.
2. Send one small manual workouts export.
3. Confirm the automatic headers and inspect object sizes without copying real payloads into Git or
   logs.
4. Confirm the R2 bytes match each submitted body.
5. Test one controlled `4xx`, `5xx`, and timeout to observe retry and Since Last Sync behavior.
6. Check whether retries reuse `session-id` and whether batches expose undocumented correlation data.
7. Create synthetic, non-personal fixtures that reproduce the observed envelopes for tests.

The endpoint intentionally archives JSON without schema validation. This lets us preserve the source
contract before deciding what D1 should contain.

## Delivery phases

### Phase 1: Implement and test raw ingestion

- Add authenticated POST routing.
- Add streaming size enforcement and R2 storage.
- Add sanitized key generation and payload-free structured logs.
- Keep D1 untouched.
- Add Worker runtime tests with synthetic metrics and workout fixtures.

Verify:

- unauthorized, wrong-method, wrong-content-type, missing-header, empty-body, oversized, and R2
  failure cases;
- successful stored bytes exactly match the request body;
- metrics and workout payload shapes are accepted;
- repeated requests create separate immutable objects;
- no D1 call occurs;
- generated Worker types, TypeScript checks, runtime tests, and deploy dry-run pass.

### Phase 2: Deploy archive-only ingestion

- Deploy the Worker and configure the dedicated production bearer secret.
- Verify `/health`.
- Configure the two Health Auto Export automations.
- Run the manual contract-capture checks.
- Enable scheduled syncing only after both manual exports are reconciled in R2.

Exit criterion: metrics and workouts are durably archived in private R2 with exact bytes, traceable
request metadata, no payload logging, and no D1 writes.

## Deferred D1 transformation

The researched next-phase architecture is tracked in `plans/health-transformation-pipeline.md`.
Provisioning and implementation remain separately review-gated.

Do not provision a Queue, create migrations, parse archived JSON, or write D1 in the current release.

When transformation work begins, start from the retained R2 corpus and separately decide:

- the exact queries or product views D1 must support;
- canonical schemas for metrics and workouts;
- record identity, overlap, corrections, and deduplication behavior;
- Queue versus Workflow execution;
- transform versioning, lineage, replay, retries, and dead-letter handling;
- backfilling all existing raw objects before enabling processing for new objects.

The future cutover should backfill retained objects first, then enable an R2 object-create notification
for new arrivals. Indefinite retention means no historical data needs to be transformed prematurely.

## Explicit non-goals

- D1 tables, migrations, or writes.
- Queue, Workflow, Cron, or R2 event-notification provisioning.
- JSON schema validation or normalization during ingestion.
- CSV or multipart ingestion.
- A public read API or website UI for health data.
- Automatic raw-object deletion.
- Exactly-once or undocumented batch-order assumptions.
- Logging health payloads for debugging.

## Remaining configuration choices

These do not block implementing the archive endpoint:

1. Which exact health metrics should the Metrics automation select?
2. Should workout route data be included?
3. Should detailed workout metrics be excluded, grouped by minute, or grouped by second?
