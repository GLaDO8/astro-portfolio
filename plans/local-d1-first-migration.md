# Local D1 first migration

Status: Implemented

## Decision

Make the health dashboard and Health Auto Export transformation workflow local-D1-first before
changing the data model. The normal development path must use one persisted local D1 database and
must not contact Cloudflare. Remote D1 access remains an explicit, separately guarded exception.

This phase deliberately keeps the current raw tables and dashboard SQL. Materialized daily, weekly,
and monthly rollups will be designed and implemented only after the local workflow is stable and
measurable.

## Outcomes

After this work:

1. `pnpm dev` reads the health dashboard from local D1 by default.
2. Local schema bootstrap, Health Auto Export imports, dashboard queries, and local migration work
   all use the same persisted database directory.
3. A fresh local database can be created without Cloudflare credentials and exercised with synthetic
   fixtures.
4. An explicitly approved one-time read-only remote export can create a full-fidelity local copy,
   including the existing medical-report rows that cannot currently be rebuilt from repository
   sources.
5. Local imports become visible after a browser reload without restarting Astro.
6. Remote reads and mutations remain separately named, fail closed, and never happen as a fallback.

## Scope boundaries

### In scope

- One shared Node-only D1 target/command runner.
- One canonical ignored local persistence directory.
- A rerunnable, schema-only local bootstrap.
- An optional one-time, non-overwriting remote-to-local clone for existing private data.
- Refactoring the existing importer and dev dashboard to use the shared target contract.
- Local freshness, error handling, reconciliation, privacy, and transaction tests.
- Documentation and verification wiring.

### Explicitly deferred

- Rollup tables at any grain.
- Rollup refresh, invalidation, or backfill logic.
- Rewriting dashboard SQL to use aggregates.
- New indexes intended for rollup queries.
- Client-side or shared-edge caching.
- Retention changes or deletion of raw facts.
- Automatic R2-to-D1 transformation.
- A new medical-report ingestion format.
- Any remote schema migration, backfill, or local-to-remote synchronization.

## Current constraints

- The dashboard command in `src/dev/health/healthDevIntegration.mjs` hardcodes `--remote`.
- The importer and dashboard independently assemble Wrangler commands and duplicate database
  configuration.
- Local migration and import commands accept `--persist-to`, but no single default directory ties
  bootstrap, import, and dashboard reads together.
- The active Health Auto Export migration stream intentionally excludes
  `workers/health-ingest/migrations/0001_medical_metrics.sql`, while the dashboard always queries the
  `medical_metrics` table.
- The repository has a Health Auto Export normalizer/importer but no importer or private seed for the
  existing medical-report values.
- Successful dashboard data is cached for the Astro dev-server lifetime, so a later local import is
  currently invisible until restart.
- The importer assumes one `wrangler d1 execute --file` is atomic, but no integration test proves
  rollback after a statement fails midway through a file.

## Target architecture

```text
reviewed private JSON  ---->  local importer  ----\
                                                   \
schema bootstrap  ------------------------------->  one persisted local D1  ---> /health
                                                   /
approved one-time remote export (optional)  ------/

normal path: local only
exceptional path: explicit remote target + exact production ID confirmation
```

Use `workers/health-ingest/.wrangler/dashboard-local` as the canonical local persistence directory.
It is already covered by the repository's `.wrangler` ignore rules. Every local command must resolve
this directory to the same absolute path before invoking Wrangler. An explicit `--persist-to` override
is allowed only for isolated tests and experiments.

## Phase 1: Establish a shared D1 target contract

Add `scripts/health/d1-runner.mjs` and move database name, Wrangler config path, executable path,
production database ID, target validation, and argument construction into it.

Use this target model:

```js
{ mode: "local", persistTo: absolutePath }
{ mode: "remote", expectedDatabaseId: exactProductionId }
```

Runner requirements:

- Default to the canonical local target.
- Accept exactly one of a SQL command or SQL file.
- Use `execFile` or `spawnSync`, never a shell.
- Add exactly one of `--local` or `--remote`.
- Add `--persist-to` only in local mode.
- Reject remote access unless the caller explicitly selects remote and provides the exact configured
  production database ID.
- Never change targets after a failure.
- Set `WRANGLER_SEND_METRICS=false`.
- Return stdout or parsed Wrangler JSON when requested so callers can reconcile results.
- Throw bounded errors that do not echo SQL, health values, credentials, private paths, or full
  Wrangler stderr.
- Allow process execution to be injected in tests.

Add unit tests before refactoring callers. Prove local defaulting, path resolution, exact argument
construction, invalid-mode rejection, the remote two-part guard, command/file exclusivity, and the
absence of `--remote` from every default path.

Exit criterion: the runner contract is tested independently, but no existing caller behavior has yet
changed.

## Phase 2: Add a credential-free local schema bootstrap

Add `scripts/health/bootstrap-local-d1.mjs` and the package command:

```sh
pnpm health:db:bootstrap:local
```

The command must be local-only and use the canonical persistence directory unless an isolated
`--persist-to` override is provided. It performs these steps in order:

1. Inspect `sqlite_schema` and the relevant PRAGMAs.
2. If absent, apply the exact existing `workers/health-ingest/migrations/0001_medical_metrics.sql`
   file to create the medical table.
3. If that table already exists, compare its columns, primary key, and constraints and fail on drift;
   skip only an exact match.
4. Apply the existing Health Auto Export migration stream selected by `wrangler.jsonc` through
   `wrangler d1 migrations apply --local --persist-to ...`.
5. Verify the expected tables, columns, indexes, triggers, applied migration records, seeded metric
   definitions, and an empty `PRAGMA foreign_key_check` result.

Do not move, merge, copy, or renumber the two existing migration histories. The bootstrap composes
them only for local dashboard use. It is schema-only: it must not fetch from R2, query remote D1, or
seed personal medical values.

An empty `medical_metrics` table is valid. The local endpoint must still return all six result sets,
with `medical: []` until the user explicitly supplies data.

Exit criterion: running bootstrap twice against a fresh isolated directory succeeds, changes nothing
on the second run, and requires neither Cloudflare credentials nor network access.

## Phase 3: Put the importer on the same local database

Refactor `scripts/health/import-health-auto-export.mjs` to call the shared runner while preserving its
current safety properties:

- A bare invocation remains a non-mutating dry run.
- `health:transform:local` defaults to the canonical local database.
- `--persist-to` remains available for isolated tests.
- `health:transform:remote` stays separately named and requires the exact production ID.
- Normalization, sequential file processing, bounded insert batches, semantic-key idempotency,
  reviewed-manifest handling, mode-`0700` temporary directories, mode-`0600` SQL files, and `finally`
  cleanup remain unchanged.

Add post-write local reconciliation using parsed D1 results:

- the source delivery is `complete`;
- every normalized semantic key exists, regardless of which earlier delivery first inserted a
  duplicate fact;
- expected optional values remain SQL `NULL`;
- foreign-key checks pass;
- replay adds no delivery or fact rows.

Add a deliberate mid-file failure integration test: insert one valid new fact, then trigger a known
database conflict later in the same generated file. Assert that the delivery and earlier fact both
roll back. If Wrangler's file execution does not pass this test, stop the phase and replace that
execution boundary with a documented atomic D1 batch/transaction mechanism. Do not hide a partial
write with cleanup.

Exit criterion: the normal dry/local/remote safety distinctions remain intact, and a local import is
both reconciled and demonstrably atomic.

## Phase 4: Make the dev dashboard local-first

Refactor `src/dev/health/healthDevIntegration.mjs` to use the shared runner.

Behavioral contract:

- `pnpm dev` reads the canonical local D1 database.
- Local schema errors return actionable guidance to run `health:db:bootstrap:local` and import the
  reviewed JSON files.
- A local error never falls back to remote.
- An exceptional remote dashboard session requires both an explicit target and exact database-ID
  confirmation. Resolve `HEALTH_DASHBOARD_D1_TARGET` and
  `HEALTH_DASHBOARD_REMOTE_CONFIRM` once at startup. Provide a separately named
  `health:dashboard:remote` package command that sets both values; normal `pnpm dev` leaves them
  unset and therefore local.
- Log the selected target once at startup without database IDs, paths, SQL, or health values.
- Keep the endpoint server-side, same-origin, development-only, GET-only, and `Cache-Control:
  no-store`.
- Keep Wrangler metadata out of the browser response.
- Execute each successful request again in local mode so newly imported data appears on reload.
- Remote mode may share one successful server-lifetime promise, but one failure must cause only one
  remote execution for that request. Remove the current blind immediate full-query retry.
- Preserve the current `HEALTH_QUERY` and six-result-set response shape in this phase.

Update the dashboard error state in `src/components/health/HealthDashboard.tsx` so local bootstrap
failures do not incorrectly instruct the user to log in to Cloudflare. Remote-mode failures may show
separate, source-aware guidance without exposing credentials or database identifiers.

Exit criterion: importing another synthetic observation while Astro remains running and then
reloading `/health` displays it, with no remote command executed.

## Phase 5: Optional one-time full-parity initializer

The schema bootstrap plus reviewed JSON replay rebuilds Apple Health data, but it cannot rebuild the
existing medical-report values. For full current-dashboard parity, add a separate operator command:

```sh
pnpm health:db:clone:local -- --database-id <exact-production-id>
```

This command is optional and requires explicit approval because it reads remote D1 and creates a
local private copy. Phases describe implementation order, not an instruction to initialize the same
database twice. For the canonical personal database, choose either schema bootstrap plus source
replay or this full-parity initializer. Automated tests always use schema bootstrap in a temporary
directory.

The clone command must:

- use Wrangler's read-only D1 export against the explicitly confirmed production database;
- refuse to run if the canonical local database already contains user tables or data;
- never delete, reset, merge into, or overwrite an existing local database;
- write the export only to a mode-`0700` temporary directory and mode-`0600` file;
- load that export into the canonical local target through the shared runner;
- remove the plaintext SQL export in `finally`, on success and failure;
- report only schema names, aggregate row counts, file size, and reconciliation status;
- never print row values, SQL statements, object keys, credentials, or database IDs;
- compare local and remote schema/table counts after import and fail on mismatch;
- perform no remote migration, transformation, write, or local-to-remote operation.

Mock every child process in its automated tests. The test suite and `verify:changed` must never call
Cloudflare. The actual clone is a manual, approval-gated operator step and should normally run once.

If the user prefers never to export remote D1, skip this phase and accept an empty local medical
section until a separate canonical medical-data importer is designed.

Exit criterion: after the optional approved operation, local D1 reproduces all current dashboard
sections and normal use returns to the zero-remote path.

## Phase 6: Command surface and documentation

Update `package.json` so the intended workflow is obvious:

```sh
# Safe, credential-free setup
pnpm health:db:bootstrap:local

# Validation remains non-mutating
pnpm health:transform:dry -- <exact-json-path>...

# Normal mutation target is the shared local store
pnpm health:transform:local -- <exact-json-path>...

# Normal dashboard target is the shared local store
pnpm dev

# Exceptional, explicitly guarded operations
pnpm health:dashboard:remote
pnpm health:transform:remote -- --database-id <exact-production-id> <exact-json-path>...
pnpm health:db:migrate:remote
```

Keep `health:dev` clearly documented as the ingestion Worker development server, not the Astro health
dashboard.

Update:

- `workers/health-ingest/README.md` with bootstrap, import, optional clone, shared-path, privacy, and
  rebuild instructions;
- `workers/health-ingest/migrations/README.md` with the local schema-composition rule and continued
  separation of remote migration histories;
- `plans/local-health-dashboard.md` to record that its original remote-read implementation has been
  superseded by local-first behavior;
- `scripts/verify-changed.mjs` so runner, bootstrap, importer, dashboard, migration, package-command,
  and documentation changes select the new local-D1 integration tests.

Exit criterion: a new local setup can be performed from the documented commands without discovering
an unstated persistence path or accidentally selecting remote D1.

## Test and verification matrix

| Layer | Verification | Pass condition |
| --- | --- | --- |
| Unit | Target resolver and runner arguments | Missing target is local; remote needs exact confirmation; invalid states fail closed. |
| Unit | Dashboard middleware | GET returns shaped JSON and `no-store`; non-GET returns 405; errors do not leak details. |
| Unit | Cache behavior | Local GETs re-query; remote successful GETs deduplicate; failures are not blindly retried. |
| Unit | Read-only dashboard SQL | Every dashboard statement is `SELECT`/`WITH`; write statements and write PRAGMAs are rejected. |
| Local integration | Fresh schema bootstrap | Medical and Apple Health schemas coexist in one isolated persisted D1 and bootstrap is rerunnable. |
| Local integration | Synthetic import | Delivery completes; semantic keys, nulls, and foreign keys reconcile. |
| Local integration | Replay | Row and delivery counts do not change. |
| Local integration | Failure atomicity | A late statement failure leaves no delivery or earlier facts from that file. |
| Local integration | Dashboard query | Six result sets return against local D1 even when medical data is empty. |
| Local integration | Target isolation | Captured bootstrap, import, and query arguments always contain `--local`, never `--remote`. |
| Browser | Local render and freshness | Synthetic data renders at `/health`; a later import appears after reload without server restart. |
| Privacy | Ignored state and cleanup | Local D1/WAL, private JSON, and temporary SQL never appear in Git status; temp files are removed on failures. |
| Build | Dev-only exclusion | Production output contains no `/health`, endpoint, D1 identifier, query, or medical schema reference. |
| Remote smoke | Separately approved read | Exactly one read-only remote query/export, zero rows written, and no value logging. |

Use only the existing synthetic fixtures under `tests/fixtures/health-auto-export/` in automated
tests. Use a fresh OS temporary persistence directory and remove it in `finally`.

Suggested verification commands:

```sh
pnpm exec node --test tests/health-dashboard-dev.test.mjs
pnpm exec node --test tests/health-d1-local.test.mjs
pnpm health:transform:test
pnpm run verify:changed
pnpm health:verify
pnpm run build:astro
git check-ignore workers/health-ingest/.wrangler/dashboard-local/probe
git status --short
```

After the production build, verify that `dist` contains no health route or D1 implementation detail.
The expected result of both probes is no matches:

```sh
find dist -iname '*health*' -print
rg -n "__dev/health-data|health-processed-data|HEALTH_DB|medical_metrics" dist
```

## Definition of done

- Importer and dashboard no longer construct Wrangler D1 commands independently.
- Bootstrap, import, and dashboard use the same canonical local database by default.
- A fresh local schema works without credentials and an empty medical table does not break the
  endpoint.
- Normal development and automated verification make zero remote D1 calls.
- Remote reads and mutations are explicit, separately named, exact-ID guarded, and never fallbacks.
- The importer is proven atomic and idempotent against real local Wrangler D1.
- Local imports are visible after browser reload.
- Private local state, exports, and source JSON remain ignored and absent from Git.
- The production build still excludes the health page and endpoint.
- No rollup schema, rollup code, aggregate-query rewrite, remote D1 mutation, or local-to-remote data
  migration is included.

## Later phase: materialized rollups

This completed foundation is followed by
[Health materialized rollups and refresh](./health-materialized-rollups.md). Its first implementation
phase remains local-only; remote migration and reader promotion require a separate approval gate.
