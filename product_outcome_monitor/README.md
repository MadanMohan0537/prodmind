<div align="center">

# Project 8: Product Outcome Monitor

**Check whether a product decision’s expected outcome persists after rollout.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 8 follows a Project 7 decision into the post-decision period. It compares baseline and observed metric series, detects persistence or reversal, checks declared guardrails, and retains the original opportunity, experiment, decision, and evidence identities.

## Place in ProdMind

```text
Project 7 reviewed decision
          ↓
Project 8 monitoring signals
          ↓
Project 9 searchable learning
```

The connected workspace invokes `analyzeOutcome` directly and persists each review inside the versioned product run.

## Implemented capabilities

- Canonical Project 7 learning-ledger adapter
- Direction-aware relative target comparison
- Baseline mean and sample standard deviation
- Descriptive three-sigma control band
- EWMA with declared lambda `0.2`
- Three-observation persistence requirement
- Early-versus-late reversal signal
- Minimum and maximum guardrail thresholds
- Limited-baseline and control-limit review signals
- Sustained, emerging, below-target and at-risk states
- Authenticated standalone Worker API
- Responsive light/dark frontend and synthetic sample

## Frontend

The standalone interface in `public/` accepts a complete monitoring snapshot and renders status, target movement, signals, guardrails and follow-up action. In the primary ProdMind interface, the same snapshot can be uploaded directly from a decided experiment card.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report configuration status |
| `POST` | `/api/analyze` | Analyze a complete standalone snapshot |
| `POST` | `/api/from-learning` | Combine a real Project 7 ledger record with observations |

The connected endpoint is `POST /api/runs/:runId/learning/:experimentId/monitor` in Project 7.

## Run and deploy

```bash
cd product_outcome_monitor
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
# npx wrangler deploy
```

## Structure

```text
src/monitor.js   Validation and deterministic monitoring
src/worker.js    Secured standalone API
public/          Working frontend and sample
tests/           Core, adapter and HTTP tests
docs/            PRD, architecture and metrics
```

## Honest limits

- Control bands and EWMA are monitoring signals, not hypothesis tests.
- The module does not adjust for seasonality, traffic mix, concurrent launches or confounding.
- It does not establish that a product decision caused an observed change.
- Baseline and observed metric data must currently be supplied explicitly.
- Human review is required before expanding or reversing a rollout.

## License

[MIT](LICENSE)
