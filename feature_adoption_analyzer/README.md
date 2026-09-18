# Feature Adoption Journey Analyzer

Project 20 closes the loop after a ProdMind release. It turns pseudonymous product events into an ordered journey—from exposure and activation to repeated value and retention—while preserving the release, decision, opportunity, and customer-evidence lineage that justified the work.

It answers: **“Are customers reaching value after this release, where do they stop, and which sufficiently large segments differ?”**

## Why it belongs in ProdMind

Shipping is not adoption. A release may pass operational checks and still be hard to discover, slow to activate, or fail to create repeat value. This module adds a deterministic post-release measurement layer without claiming that the release caused the observed behavior.

```text
Project 19 readiness report + pseudonymous events
                         ↓
 ordered stages + first occurrence per user
                         ↓
 conversion + time-to-value + privacy-safe segments
                         ↓
          evidence-linked adoption report
```

## Implemented

- Defines 2–8 ordered stages for each release journey.
- Uses the first observed timestamp per user and stage.
- Calculates step conversion, end-to-end completion, and median time-to-value.
- Excludes users whose segment changes within the supplied snapshot or whose timestamps contradict stage order.
- Suppresses segment rates below a configurable minimum cohort size.
- Rejects duplicate event IDs, unknown releases, unknown stages, and oversized inputs.
- Carries forward `portfolioItemId`, evidence IDs, ship-decision IDs, assumption IDs, release version, and readiness status.
- Provides authenticated Cloudflare Worker and accessible light/dark interface.
- Uses deterministic JavaScript only: no paid API, model, cookie, identity graph, or database requirement.

## API

`POST /api/adoption` accepts `runs`, a Project 19 `readinessReport`, and `input.journeys`.

Project 7 exposes `POST /api/feature-adoption`. Its body contains Project 18 `assumptions`, Project 19 `releases`, optional `asOf`, and Project 20 `journeys`; the connected Worker reconstructs both upstream reports from persisted runs.

Each journey includes an `id`, `releaseId`, ordered `stages`, optional `minSegmentSize`, and events containing `eventId`, pseudonymous `userId`, `stage`, ISO `timestamp`, and `segment`. See the tests for a complete executable example.

## Run

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Interpretation boundaries

- Conversion is descriptive, not causal. Use an experiment to infer treatment effects.
- A `userId` must already be pseudonymous; this module does not hash or resolve identities.
- Segment suppression reduces disclosure risk but is not a complete privacy program.
- Event instrumentation, bot filtering, consent, retention, and deletion policies remain deployment responsibilities.
- A blocked release can be analyzed for diagnostics, but its readiness status remains visible.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
