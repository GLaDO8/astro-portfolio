# Generic count logging endpoint

## Goal

Add an authenticated Worker endpoint that lets an iOS Shortcut store a non-negative integer count
under a caller-defined type without mixing manual observations into Apple Health samples.

## Contract

- `POST /v1/log/count`
- Reuse the existing `HEALTH_INGEST_TOKEN` bearer token.
- Require a JSON object with `type`, `count`, `observed_at`, and `idempotency_key`.
- Treat `count` as the complete observed value, not an increment.
- Require `observed_at` to include `Z` or an explicit UTC offset, then retain its instant, local date,
  and offset.
- Return `201` for a new event, `200` for an exact retry, and `409` if an idempotency key is reused
  with different data.
- Never log the request body, count type, count value, timestamp, token, or idempotency key.

## Steps

1. [Complete] Add focused tests for routing, authentication, validation, persistence, retry
   behavior, and safe logging.
2. [Complete] Add a strict D1 table for manual count events and implement the endpoint with
   prepared statements.
3. [Complete] Document an iOS Shortcuts request example and the separate migration/deployment
   steps.
4. [Complete] Run the Worker test, generated-type check, TypeScript check, Wrangler deployment dry
   run, and isolated local D1 bootstrap.

## Rollout boundary

The remote D1 migration and Worker deployment were separately approved on 2026-08-16. The rollout
must apply tracked migrations in order, preserve existing health facts, verify the new table before
deploying, and confirm the live route with an idempotent synthetic request.

Deployed as Worker version `537aa0de-bd2f-4258-a1cb-fe28ef505418`. Live checks confirmed the health
route, exact count route, method guard, bearer-authentication boundary, empty `count_events` table,
and unchanged source fact counts. An authenticated synthetic write was not performed because the
production bearer secret is write-only in Cloudflare and unavailable in the connected 1Password
environment; rotating it solely for verification would break the existing exporter.
