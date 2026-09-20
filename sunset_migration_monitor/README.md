# Customer Migration & Sunset Monitor

Project 22 verifies whether a Project 21 consolidation or retirement plan is operationally ready for a human-controlled sunset. It reconciles aggregate customer cohorts, dependencies, delivered notices, exceptions, legacy usage, shutdown checks, and final approvals while preserving the original evidence chain.

It answers: **“Did everyone and everything that must move actually move, and is there evidence to justify a human sunset decision?”**

## Why it belongs in ProdMind

A complete plan is not a completed migration. Customer notices can fail, integrations can remain active, exceptions can outlive their owners, and a legacy endpoint can still receive traffic after the target date. Project 22 prevents a calendar date from becoming an automatic shutdown trigger.

```text
Project 21 approved plan + aggregate migration snapshot
                              ↓
 cohorts + dependencies + notices + exceptions + telemetry
                              ↓
 shutdown checks + final cross-functional approval
                              ↓
       ready for human sunset / hold / overdue hold
```

## Implemented

- Accepts aggregate cohorts only; no customer-level identifiers are required.
- Reconciles migrated, exempted, blocked, and remaining counts.
- Requires evidence for every dependency declared by Project 21.
- Verifies notice delivery rather than treating a schedule as delivery.
- Blocks open exceptions and failed shutdown checks.
- Requires zero observed legacy use for a configurable consecutive-day window.
- Requires final Product, Engineering, and Support approval.
- Marks unresolved snapshots after the planned date as `overdue_hold`.
- Preserves journey, release, portfolio, evidence, decision, and assumption lineage.
- Includes authenticated Cloudflare Worker, light/dark UI, documentation, and tests.
- Requires no paid API or model.

## API

`POST /api/sunset-monitor` accepts `runs`, a Project 21 `lifecycleReport`, and `input.snapshots`.

Project 7 exposes `POST /api/sunset-migration`. It reconstructs Projects 18–21 from the submitted assumptions, releases, journeys, lifecycle plans, and migration snapshots.

## Run

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Boundaries

- `ready_for_human_sunset` is a completeness result, not shutdown authorization.
- The module does not notify customers, migrate data, change traffic, disable services, revoke access, or delete data.
- A Sunset header or target date is a signal, not proof that a resource will become unavailable.
- Supplied receipts and verification evidence are declarations; production integrations must authenticate them.
- Contractual, regulatory, accessibility, retention, and deletion requirements remain human responsibilities.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
