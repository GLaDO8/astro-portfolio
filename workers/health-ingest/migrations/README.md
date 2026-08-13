# D1 migrations

The active migration stream is isolated in `health-auto-export/`. The parent
`0001_medical_metrics.sql` belongs to separate work and is intentionally excluded by
`wrangler.jsonc`.

Apply the health transformation migration to a fresh, explicit local state directory first:

```sh
pnpm health:db:migrate:local -- --persist-to <isolated-directory>
```

Before any remote apply, list the remote migrations read-only and verify that only the reviewed
health migration is pending:

```sh
pnpm exec wrangler d1 migrations list health-processed-data --config workers/health-ingest/wrangler.jsonc --remote
```

Remote migration is an explicit production mutation and requires separate approval:

```sh
pnpm health:db:migrate:remote
```
