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

The Worker exposes:

- `GET /health`, which verifies both bindings without writing data.
- `POST /v1/ingest/health-auto-export`, which authenticates a Health Auto Export request and
  archives its unchanged body in R2.

The production endpoints are:

- `https://health-ingest.glado8.workers.dev/health`
- `https://health-ingest.glado8.workers.dev/v1/ingest/health-auto-export`

The ingestion route requires a bearer token, `application/json`, `automation-id`, and `session-id`.
It rejects empty bodies and requests over 25 MiB. Bodies with a declared length stream through a
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
