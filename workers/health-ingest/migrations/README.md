# D1 migrations

Add numbered SQL migrations here after the HealthyApps JSON contract and canonical tables are
defined. Apply migrations locally first:

```sh
pnpm health:db:migrate:local
```

Remote migration is an explicit production mutation and must be run separately:

```sh
pnpm health:db:migrate:remote
```
