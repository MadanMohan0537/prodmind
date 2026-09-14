# Product Benefits Realization Tracker

Project 16 closes ProdMind’s value loop. It records the expected benefit behind a selected product opportunity, compares that target with an observed measurement, and retains the original evidence, experiment, decision and outcome-review identities.

The tracker answers **“did the intended benefit materialize?”** It does not claim that the product change caused the measurement, fabricate ROI, or add unlike units.

## Why this belongs in ProdMind

Projects 1–15 move from feedback to a resilient portfolio, but delivery alone is not value. Benefits-management practice explicitly identifies, plans, tracks, realizes and sustains benefits. This module adds that missing post-delivery accountability layer.

```text
Customer evidence → opportunity → experiment → decision → outcome review
                                                        ↓
                                      expected benefit + owner + target
                                                        ↓
                                      observed measure + progress + review
```

## What is implemented

- Deterministic increase and decrease target calculations.
- Statuses: `realized`, `on_track`, `at_risk`, `below_target`, `not_measured`, and `overdue`.
- Canonical `portfolioItemId` (`runId:opportunityId`) resolution against selected work only.
- Evidence, experiment, decision, and outcome-review lineage in every benefit result.
- Per-unit summaries without summing incompatible measures.
- Required owner, dates, unit, baseline, target, observation, and attribution note.
- Authenticated Cloudflare Worker API with a streamed 2 MB request limit.
- Responsive, system-aware light/dark frontend.
- No paid API, model, database, or software dependency.

## API contract

`POST /api/benefits`

```json
{
  "runs": [{"id":"run-1","ranking":{"portfolio":{"selected":["opp-1"]},"ranked":[{"id":"opp-1","title":"Improve onboarding","evidenceIds":["f-1"]}]}}],
  "options": {
    "asOf": "2026-09-14",
    "benefits": [{
      "id": "activation-lift",
      "portfolioItemId": "run-1:opp-1",
      "name": "New-user activation",
      "unit": "percentage_points",
      "direction": "increase",
      "baseline": 40,
      "target": 50,
      "actual": 48,
      "baselineAt": "2026-06-01",
      "targetAt": "2026-10-01",
      "measuredAt": "2026-09-01",
      "owner": "Growth PM",
      "attributionNote": "Reviewed with the controlled experiment; other releases may contribute."
    }]
  }
}
```

The connected Project 7 endpoint is `POST /api/benefits-realization`. It supplies recent D1-backed runs, so its body contains `benefits` and optional `asOf` directly.

## Run and test

```bash
npm install
npm run check
```

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Deliberate boundaries

- Progress is arithmetic, not causal inference.
- `attributionNote` is mandatory human judgment.
- Negative progress and overachievement remain visible.
- Mean progress is reported only within one declared unit.
- The tracker never edits rankings, decisions, roadmaps, or forecasts.
- One bearer token is appropriate only for one trusted team, not multi-tenant isolation.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
