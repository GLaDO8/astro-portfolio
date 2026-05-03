# Agent Guidance Audit

Created: 2026-05-03
Updated: 2026-05-04
Status: implementation in progress

## Goal

Reduce repeated context loading, lower tool-call count, and make future agents infer Site 2.0 intent faster.

## Evidence Base

- Raw Codex session corpus for `cwd=/Users/shreyasgupta/local-documents/site-2.0`: 172 sessions from April-May 2026.
- Tool volume in those sessions: 8,935 total tool calls, 7,504 shell calls, 374 failed shell calls.
- The biggest repeated shell categories were file reads, browser probing, source search, verification, and git/status reads.
- Common repeated commands:
  - `git status --short`: 227 times.
  - `npm run build`: 103 times.
  - `pnpm run build`: 65 times.
  - `sed -n ... how-to-plan.md`: 81 times.
  - `sed -n ... cli-tools.md`: 91 times.
  - `sed -n ... agent-browser/SKILL.md`: 50 times.
  - `git diff --stat`: 47 times.
  - `lsof -iTCP -sTCP:LISTEN -nP`: 31 times.
  - `agent-browser open http://localhost:4321/`: 25 times.

## Decisions

### Repo Map

The stable repo map belongs in `AGENTS.md`, not in a script. A script is useful only for live state that would go stale in docs: branch, dirty files, active plan, running dev server, and generated route inventory.

Current decision:
- Do not add `pnpm agent:context` for now.
- Keep static ownership guidance in `AGENTS.md`.
- Revisit a script only if live-state reconnaissance remains noisy after the other fixes.

### Package Manager

Use `pnpm` consistently. The repo declares `pnpm@10.33.0`, so `npm` script usage creates false drift.

Implemented:
- `.codex/environments/environment.toml` uses `pnpm run dev`.
- `AGENTS.md` tells agents to use `pnpm` for all repo scripts.

### Browser Verification

Browser verification is still required for this repo. The improvement is not replacing browser checks; it is making each browser check return more evidence in one call.

Better shape:
- One `agent-browser eval` should collect the target element, parent chain, computed styles, bounding rects, and `outerHTML`.
- Avoid separate calls for "what is the element", "what is the parent", "what is the style", and "what is the geometry".

Current decision:
- Document the one-probe expectation in `AGENTS.md`.
- Do not add a browser helper script yet.

### Tiered Verification

Full production builds are too expensive for every narrow edit. Keep them for broad changes, release checks, and final confidence.

Implemented:
- `pnpm run verify:changed`
- `pnpm run verify:content`
- `pnpm run build:astro` runs Astro's build without the `pnpm images` prepass.
- `pnpm run build` remains the full production build with image optimization.

### Planning Files

Homepage revamp is complete. The old homepage and migration plan files should not remain active context.

Implemented:
- `plans/agent-guidance-audit.md` is the only retained plan artifact.
- `plans/plan.md` is removed.

### Task-Family Routing

Detailed task-family routing is overkill for this repo. Some areas, like snaps, had repeated sessions during active work but are not permanent recurring agent entrypoints.

Current decision:
- Do not add a big task-family routing section.
- Keep only compact stable ownership notes in `AGENTS.md`.

### RTK

The blanket "prefix every shell command with `rtk`" rule is too broad for this repo. `rtk find` and complex shell shapes have already caused retries.

Implemented:
- `AGENTS.md` says to use direct shell for `find`, complex quoting, heredocs, browser commands, and exact raw behavior.
- Use `rtk` only where token filtering is useful and the command shape is known to work.

### Dev-Only Tooling

Temporary/dev-only UI should not sit beside production components.

Implemented:
- Hero Google font swap UI moved under `src/dev/`.
- Production homepage imports it from `@/dev/...` and still gates it behind `import.meta.env.DEV`.

## Remaining Follow-Ups

- Add regression tests for known drift points if they recur:
  - `Navbar.astro` SSR active classes and client-side `activeClasses` stay in sync.
  - `Document.astro` keeps `Navbar` outside `[data-shell-content]`.
  - dev-only controls remain gated behind `import.meta.env.DEV`.
- Reconsider a live-state `agent:context` script only if agents still spend too many calls on branch/status/server/route discovery.
