# Project 35 — Product Planning Policy Rollout Assurance Monitor

Project 35 verifies that a human-executed planning-policy rollout followed the safe-change plan approved by Project 34.

## What it checks

- Activation did not precede the approved effective date.
- Every approved rollout percentage was observed in order.
- Each stage completed its minimum dwell period.
- Every snapshot used the approved target version.
- Every declared monitor was present and inside its threshold.
- Every stage retained reviewable evidence.
- A named human selected `continue`, `pause`, or `rollback`.

A passing `continue` review becomes `verified_rollout`. A failed prerequisite produces `blocked_continue`; `pause` and `rollback` remain `action_required` because the system never performs either action.

## Run and deploy

```bash
npm test
npx wrangler dev
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Send authenticated JSON to `POST /api/planning-policy-rollouts` with `runs`, the Project 34 `changeReport`, and rollout reviews in `input`.

## Architecture and boundaries

- Deterministic dependency-free monitor
- Authenticated Cloudflare Worker with 2 MB streaming limit
- Same-origin API enforcement and restrictive security headers
- Responsive light/dark browser interface
- No paid APIs, hosted models, cookies, analytics, or runtime dependencies
- Never activates, pauses, continues, or rolls back a policy

See [product requirements](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## Research basis

NIST continuous-monitoring guidance motivates ongoing assurance and timely response. Google SRE guidance motivates gradual stages, incubation periods, monitor-based decisions, and rapid return to a known-good state. GAO evidence practices motivate retaining performance information behind implementation decisions. These sources inform the design; they do not certify it.

## License

MIT
