# Product Lifecycle & Deprecation Planner

Project 21 turns Project 20 adoption evidence into a governed lifecycle plan. A product team explicitly chooses to **retain, invest, consolidate, or retire** a capability; the engine checks whether the decision has sufficient lineage, ownership, notice, migration, dependency, communication, exit-criteria, and human-approval controls.

It answers: **“Can we responsibly execute this human lifecycle decision without surprising customers or stranding dependencies?”**

## Why it belongs in ProdMind

Shipping and measuring a feature are not the end of product management. Capabilities accumulate support cost, overlap, technical risk, and customer dependencies. Removing them solely because adoption is low can harm a small but critical cohort. Project 21 makes that trade-off inspectable without pretending a formula should choose the decision.

```text
Project 20 adoption report + human lifecycle decision
                           ↓
 affected use + dependencies + replacement readiness
                           ↓
 notice + communication + exit criteria + approvals
                           ↓
              ready for human execution / blocked
```

## Implemented

- Supports `retain`, `invest`, `consolidate`, and `retire` decisions.
- Derives affected usage and complete lineage from Project 20 instead of caller-supplied substitutes.
- Validates configurable notice windows up to three years.
- Requires a pilot or available replacement and migration guide for consolidation or retirement.
- Tracks owned dependency migrations and blocks unresolved dependencies.
- Checks that communications are scheduled before sunset.
- Requires explicit exit criteria plus Product, Engineering, and Support approval for retirement paths.
- Preserves release, opportunity, evidence, ship-decision, and assumption identifiers.
- Provides an authenticated Cloudflare Worker and system-aware light/dark interface.
- Uses deterministic JavaScript only; no paid API or model is required.

## API

`POST /api/lifecycle` accepts `runs`, a Project 20 `adoptionReport`, and `input.plans`.

Project 7 exposes `POST /api/product-lifecycle`. The connected endpoint reconstructs Projects 18–20 from persisted runs and the submitted assumptions, releases, journeys, and plans before returning Project 21 results.

## Run

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Boundaries

- The engine validates a human-selected action; it never recommends or executes retirement.
- Low adoption alone is not a retirement justification.
- `ready_for_human_execution` means declared controls are complete, not that customers will be unharmed.
- The module does not send notices, migrate dependencies, disable traffic, delete data, or enforce contracts.
- Teams must set notice requirements that meet their legal, contractual, and policy obligations.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
