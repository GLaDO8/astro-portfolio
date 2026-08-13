# Health ingestion Worker

This Worker is the private backend boundary for Apple Health exports. It is configured to bind to:

- R2 `health-raw-data` as `HEALTH_RAW`
- D1 `health-processed-data` as `HEALTH_DB`

The Astro site remains a separate static application. Local Wrangler development uses local R2 and
D1 emulation by default; it does not connect to the production health stores.

## Commands

```sh
pnpm health:types
pnpm health:test
pnpm health:typecheck
pnpm health:verify
pnpm health:dev
pnpm health:deploy:dry
```

The raw archive and transformation pipeline are separate. Transform exact local JSON files with:

```sh
pnpm health:transform:test
pnpm health:transform:dry -- <exact-json-path>...
pnpm health:db:migrate:local -- --persist-to <isolated-directory>
pnpm health:transform:local -- --persist-to <same-isolated-directory> <exact-json-path>...
```

Do not glob Downloads: the reviewed corpus is an explicit 13-file manifest and an extra full-January
export is intentionally excluded. Dry-run validates and reports only hashes, counts, ranges, and
timings. Local mode writes only Wrangler's local D1 state. The importer uses private mode-restricted
temporary SQL files and deletes them after each source file.

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

Remote migration and transformation are production mutations. They remain approval-gated after all
local reconciliation checks pass. Remote transformation additionally requires the configured D1 ID:

```sh
pnpm health:transform:remote -- --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f <exact-json-path>
```

The archive route remains archive-only: transformation failures cannot affect webhook ingestion or
immutable R2 retention.
