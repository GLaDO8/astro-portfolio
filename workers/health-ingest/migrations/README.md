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

The Health Auto Export stream is ordered as follows:

1. `0001_health_auto_export.sql` creates deliveries, metric facts, sleep summaries, and definitions.
2. `0002_add_weight_body_mass.sql` adds body-mass support.
3. `0003_metric_rollups.sql` adds the disposable day/week/month projection and singleton refresh
   state, and marks the two unreviewed sound-level operators as unsupported.
4. `0004_count_events.sql` adds idempotent, manually observed count events for the authenticated
   iOS Shortcuts endpoint. These facts remain separate from Apple Health samples and rollups.

Migration `0003` initializes an empty database as `ready`. If facts already exist, it initializes as
`needs_backfill`; run `pnpm health:rollups:backfill:local` before using the local dashboard.

For an isolated migration experiment, use:

```sh
pnpm health:db:bootstrap:local --persist-to <isolated-directory>
```

Remote promotion of `0003` is deferred. You may list remote migrations read-only:

```sh
pnpm exec wrangler d1 migrations list health-processed-data --config workers/health-ingest/wrangler.jsonc --remote
```

Do not apply the pending migration remotely in this phase. The repository migration command fails
closed while rollup promotion is deferred. A separately approved promotion plan must snapshot
remote state, apply only the reviewed migration, backfill and reconcile bounded chunks, then switch
the reader only after state is ready. The standalone medical migration remains separate.
