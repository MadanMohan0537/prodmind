# Product Release Readiness & Rollback Controller

Project 19 bridges a reviewed ProdMind `ship` decision and a safe production rollout. It checks progressive exposure, production monitoring, rollback triggers, a last-known-good version, ownership, compatibility, communications, and unresolved Project 18 assumptions.

It answers: **“Is this product decision operationally ready to release, and can the team reverse it quickly?”**

## Why it belongs in ProdMind

A product experiment can support shipping while the release itself remains unsafe. Canary delivery limits initial exposure; supervised monitoring reveals unexpected behavior; a prepared rollback reduces recovery time. This module turns those operational commitments into an inspectable product gate.

```text
Reviewed ship decision + evidence + Project 18 assumptions
                         ↓
 staged rollout + monitors + thresholds + ownership
                         ↓
 last-known-good version + rollback procedure
                         ↓
                  ready / blocked
```

## Implemented

- Requires an upstream human `ship` decision.
- Validates 1–10 strictly increasing rollout steps ending at 100%.
- Requires named monitors with source, threshold, direction, and window.
- Validates rollback triggers against those monitors.
- Checks last-known-good version, rollback owner, procedure, on-call owner, and backward compatibility.
- Blocks unresolved high-exposure Project 18 assumptions.
- Preserves opportunity, evidence, experiment, decision, and assumption lineage.
- Authenticated Cloudflare Worker and system-aware light/dark interface.
- No paid service, deployment access, or automatic traffic mutation.

## API

`POST /api/readiness` accepts `runs`, a Project 18 `assumptionReport`, and `options.releases`. Project 7 exposes `POST /api/release-readiness`; its body contains `assumptions`, optional `asOf`, and `releases`.

Each release defines `id`, `portfolioItemId`, `version`, owners, strategy, `rolloutSteps`, `monitors`, `rollback`, `backwardCompatible`, and `communicationPlan`. See the tests for an executable example.

## Run

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Boundaries

- `ready` means declared checks passed; it does not guarantee a safe release.
- The module never deploys, changes traffic, or invokes rollback.
- Threshold quality and monitor correctness remain human responsibilities.
- Compatibility is a reviewed declaration, not a schema or binary analysis.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
