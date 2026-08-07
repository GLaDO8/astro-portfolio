# Health ingestion Worker

This Worker is the private backend boundary for Apple Health exports. It is configured to bind to:

- R2 `health-raw-data` as `HEALTH_RAW`
- D1 `health-processed-data` as `HEALTH_DB`

The Astro site remains a separate static application. Local Wrangler development uses local R2 and
D1 emulation by default; it does not connect to the production health stores.

## Commands

```sh
pnpm health:types
pnpm health:typecheck
pnpm health:verify
pnpm health:dev
pnpm health:deploy:dry
```

The initial Worker exposes `GET /health`, which verifies both bindings without writing data.

## Secrets

For local development, copy `.dev.vars.example` to `.dev.vars`. Wrangler ignores the real file via
the repository `.gitignore`.

Set the production REST-ingestion token interactively:

```sh
pnpm health:secret:set
```

Never commit the token or reuse the local HealthyApps MCP token for REST ingestion.

## Production operations

Deployments and remote migrations are intentionally separate commands. Running local development,
type generation, type checking, or dry-run deployment does not modify the existing Cloudflare R2 or
D1 resources.
