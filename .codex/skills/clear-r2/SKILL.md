---
name: clear-r2
description: Safely clear all archived Apple Health and Health Auto Export objects from the project's private Cloudflare R2 bucket using a frozen manifest and exact Wrangler deletions. Use when the user invokes /clear-R2, $clear-r2, asks to empty or reset health-raw-data before a clean export/backfill, or wants to remove all current health export objects while preserving the bucket, Worker, bindings, secret, and D1.
---

# Clear Health R2

Clear only the objects present in one asserted snapshot of `health-raw-data`. This exact bucket name is hardcoded in the script and cannot be supplied through arguments or environment variables. Never delete the bucket, Worker, bindings, secret, or D1. Never delete by prefix or loop until empty.

## Prepare

Run from the repository root:

```sh
node .codex/skills/clear-r2/scripts/clear-r2.mjs prepare
```

This read-only command writes a manifest under the system temporary directory and prints its path, object count, bytes, and boundary keys. It does not read payload bodies.

Show that summary to the user. State that R2 deletion is not recoverable except by another export. Obtain explicit confirmation for the exact count and bytes before continuing. The original invocation is not a substitute for confirming the freshly observed snapshot.

Require the user to pause Health Auto Export and every other writer to this bucket before execution. Wrangler deletion is exact-key but not conditional on ETag, so execution must not race a same-key replacement.

## Execute

After confirmation, use the unchanged manifest path printed by `prepare`:

```sh
node .codex/skills/clear-r2/scripts/clear-r2.mjs execute /absolute/path/to/manifest.json
```

The script must:

1. Re-list immediately and abort if any key, size, ETag, count, or byte total changed.
2. Delete only the frozen keys with exact `wrangler r2 object delete ... --remote --force` commands.
3. Re-list once, verify all target keys are absent, and report later arrivals without deleting them.

Report deleted count/bytes and remaining later arrivals. Do not print health payloads or values.

## Boundaries

- Do not substitute `wrangler r2 bucket delete`.
- Do not create or deploy an admin Worker.
- Do not rerun `prepare` after confirmation without showing the new snapshot and confirming it again.
- Treat every current object in this dedicated raw-health bucket as in scope. Stop if the user says the bucket contains non-export objects.
- Stop on authentication, account-selection, manifest-drift, or deletion errors.
