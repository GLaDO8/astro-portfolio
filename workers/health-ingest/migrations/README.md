# D1 migrations

The active Health Auto Export migration stream is isolated in `health-auto-export/`. The parent
`0001_medical_metrics.sql` belongs to a separate remote migration history and remains intentionally
excluded by `wrangler.jsonc`.

The local dashboard needs both schemas. Compose them only through the rerunnable local bootstrap:

```sh
pnpm health:db:bootstrap:local
```

Bootstrap applies the existing medical schema first, verifies an exact match if it already exists,
and then applies the Health Auto Export stream to the shared local D1 directory. It does not move,
copy, merge, or renumber either migration history, and it does not seed personal medical values.

For an isolated migration experiment, use:

```sh
pnpm health:db:bootstrap:local --persist-to <isolated-directory>
```

Before any remote apply, list the remote migrations read-only and verify that only the reviewed
health migration is pending:

```sh
pnpm exec wrangler d1 migrations list health-processed-data --config workers/health-ingest/wrangler.jsonc --remote
```

Remote migration is an explicit production mutation and requires separate approval:

```sh
pnpm health:db:migrate:remote --database-id 7f570a9a-fab7-4f17-a69a-c7717320802f
```

The remote command applies only the migration directory configured in `wrangler.jsonc`; it does not
compose or apply the standalone medical migration.
