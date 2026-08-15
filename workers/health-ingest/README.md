# Health ingestion Worker

This Worker is the private backend boundary for Apple Health exports. It is configured to bind to:

- R2 `health-raw-data` as `HEALTH_RAW`
- D1 `health-processed-data` as `HEALTH_DB`

The Astro site remains a separate static application. Its development-only `/health` dashboard and
the transformation tools use one persisted local D1 database by default. Normal local development
does not connect to the production health stores.

## Commands

```sh
pnpm health:types
pnpm health:test
pnpm health:typecheck
pnpm health:verify
pnpm health:dev
pnpm health:deploy:dry
```

`health:dev` starts the health-ingestion Worker. It does not start the Astro site or its `/health`
dashboard; use `pnpm dev` for that.

## Local dashboard database

Bootstrap the shared local schema, import reviewed Health Auto Export files, and then start Astro:

```sh
pnpm health:db:bootstrap:local
pnpm health:transform:dry <exact-json-path>...
pnpm health:transform:local <exact-json-path>...
pnpm health:medical:sync:local --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f
pnpm dev
```

Bootstrap, import, and dashboard queries share the ignored
`workers/health-ingest/.wrangler/dashboard-local` persistence directory. Bootstrap is schema-only
apart from initializing rollup state, and it is rerunnable. It creates an empty `medical_metrics`
table alongside the Health Auto Export schema; it does not fetch from R2 or seed personal medical
values. A fresh empty database starts with rollup state `ready`. Applying migration `0003` to a
local database that already has facts sets the state to `needs_backfill`.

### Materialized metric rollups

`metric_samples` remains the lossless source of truth. `metric_rollups` is a disposable versioned
projection at day, Monday-starting week, and calendar-month grains. Sleep and medical rows remain in
their existing tables. Missing periods remain absent rather than becoming zero.

After upgrading an existing local database, rebuild the complete projection before opening the
dashboard:

```sh
pnpm health:rollups:backfill:local
```

The backfill clears only `metric_rollups`, builds daily rows in calendar-month chunks, composes week
and month rows from daily sufficient statistics, reconciles both directions, and marks state ready
only after all checks pass. It is safe to rerun. An interrupted run remains non-ready, and the local
dashboard returns the backfill command instead of silently scanning raw facts.

Every successful local import refreshes only its touched day buckets and affected weeks/months in
the same atomic SQL execution as its facts. Exact replay does no rollup work. Unchanged overlaps do
not rewrite identical rows. For a bounded correction or reconciliation, use an inclusive range:

```sh
pnpm health:rollups:refresh:local -- --start YYYY-MM-DD --end YYYY-MM-DD
pnpm health:rollups:refresh:local -- --metric step_count --start YYYY-MM-DD --end YYYY-MM-DD
```

Both commands are intrinsically local-only and log only version, range, bucket counts, duration, and
reconciliation status. The dashboard reads complete weekly activity/recovery trends, sparse daily
VO2 max and weight observations, and daily summary values. Its response stays private, dev-only,
and `no-store`.

The medical sync reads only the remote D1 `medical_metrics` table. It replaces that table in the
shared local database, compares every ordered local row with the remote snapshot, and removes its
private temporary SQL file before exiting. It does not read or parse the source PDFs, change remote
D1, or touch the local Apple Health tables. The exact database ID is required as confirmation.

Do not glob Downloads. Use only exact reviewed files, and keep private source JSON outside this
repository. Dry-run validates and reports only hashes, counts, ranges, and timings. Local mode writes
only the shared local D1 state. The importer uses private mode-restricted temporary SQL files and
deletes them after each source file.

For isolated tests or migration experiments, the local bootstrap and transformation commands accept
`--persist-to <isolated-directory>`. Both commands must receive the same directory.

### Optional full-parity clone

The reviewed JSON corpus cannot rebuild the existing medical-report values. With explicit approval,
create a one-time read-only remote export and private local copy instead:

```sh
pnpm health:db:clone:local --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f
```

Choose either this clone or schema bootstrap plus source replay for the canonical local database.
The clone refuses to overwrite or merge into an initialized local database. It never migrates or
writes remote D1, and it removes its plaintext export after reconciliation.

The local D1 directory contains private health data. Do not commit, share, or copy it into public
build output. To rebuild it, stop Astro, move the canonical directory to a private backup location,
then rerun bootstrap and the reviewed imports. Remove the backup only after the rebuilt database has
been reconciled.

The Worker exposes:

- `GET /health`, which verifies both bindings without writing data.
- `POST /v1/ingest/health-auto-export`, which authenticates a Health Auto Export request and
  archives its unchanged body in R2.

The production endpoints are:

- `https://health-ingest.glado8.workers.dev/health`
- `https://health-ingest.glado8.workers.dev/v1/ingest/health-auto-export`

The ingestion route requires a bearer token, `application/json`, `automation-id`, and `session-id`.
It rejects empty bodies and requests over 90 MiB. This stays below Cloudflare's 100 MB request-body
limit on Free and Pro plans while allowing Health Auto Export's larger JSON batches. Bodies with a declared length stream through a
fixed-length R2 write; chunked bodies use an abortable multipart upload so the limit is still
enforced without buffering the complete request. D1 is not accessed by ingestion.

## Secrets

For local development, copy `.dev.vars.example` to `.dev.vars`. Wrangler ignores the real file via
the repository `.gitignore`.

Set the production REST-ingestion token interactively:

```sh
pnpm health:secret:set
```

Never commit the token or reuse the local HealthyApps MCP token for REST ingestion.

## Production operations

Deployments and remote migrations are intentionally separate commands. Runtime tests use local R2
and D1 emulation plus a synthetic token. Running local development, tests, type generation, type
checking, or dry-run deployment does not modify the existing Cloudflare R2 or D1 resources.

Payload-free structured logs are retained in Cloudflare Observability. View them in the Cloudflare
dashboard under Workers & Pages > health-ingest > Observability, or stream them locally with:

```sh
pnpm exec wrangler tail health-ingest --format pretty
```

Useful event names are `health_ingest.archived`, `health_ingest.rejected`,
`health_ingest.archive_failed`, `health_ingest.health_ok`, and
`health_ingest.health_check_failed`. Request bodies and health values are never logged.

Remote transformations remain exceptional and exact-ID guarded:

```sh
pnpm health:transform:remote --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f <exact-json-path>
```

Migration `0003`, its backfill, and rollup-backed dashboard reads are intentionally local-only in
this phase. The remote migration command fails closed until a separate promotion plan is approved;
do not invoke Wrangler migrations directly to bypass that gate.

Normal `pnpm dev`, bootstrap, local transformation, tests, and verification never fall back to
remote D1.

The archive route remains archive-only: transformation failures cannot affect webhook ingestion or
immutable R2 retention.
