# Product Sunset Outcome & Reversibility Monitor

Project 23 closes ProdMind’s product-retirement loop. Project 22 can show that customers, dependencies, notices, exceptions, and zero-use evidence are ready for a human sunset decision. This project asks the harder follow-up: **did the completed sunset work, and can the team still recover safely?**

## What it does

- Preserves the complete Project 22 evidence chain.
- Enforces a 1–365 day observation window.
- Checks support-contact changes against a declared tolerance.
- Checks critical and customer-impacting incidents against explicit limits.
- Requires zero residual traffic.
- Compares expected and observed monthly savings in one declared currency.
- Requires an owned, tested rollback procedure within a recovery-time target.
- Tracks owned corrective actions and overdue work.
- Records a named human decision: `close`, `extend_monitoring`, or `restore_service`.

The engine never performs those actions. A `close` decision is reported as `blocked_close` when any deterministic check fails.

## Why this belongs in ProdMind

Without Project 23, the workflow ends at shutdown readiness. A technically clean migration can still increase support burden, create incidents, leave hidden traffic, miss its savings case, or lose its recovery path. This module turns retirement into a measured, reversible product decision rather than an unverified endpoint.

## Flow

```text
Project 22 sunset evidence
          ↓
Observation-window validation
          ↓
Customer harm + incidents + residual traffic
          ↓
Observed-versus-expected savings
          ↓
Rollback readiness + corrective actions
          ↓
Named human close / monitor / restore decision
```

## Run locally

```bash
cd sunset_outcome_monitor
npm test
npm run check
npx wrangler dev
```

Set `API_TOKEN`, then send `POST /api/sunset-outcomes` with `runs`, `sunsetReport`, and `input.reviews`.

## Honest boundaries

- Support and incident counts are supplied observations, not causal proof.
- Savings are a transparent expected-versus-observed comparison; the engine does not calculate ROI across currencies.
- Rollback readiness validates declared evidence; it cannot guarantee recovery.
- The engine never changes traffic, deploys, restores, closes, or deletes anything.
- The bearer token is suitable for one trusted team, not tenant isolation.

## Research basis

- [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) distinguishes sunset from earlier deprecation and defines when a resource is expected to become unresponsive.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final) treats reconstitution as tested validation before owners declare a system recovered.
- [Google SRE postmortem practices](https://sre.google/workbook/postmortem-culture/) emphasize reviewed learning, accountable ownership, and action items.
- [FinOps workload placement guidance](https://www.finops.org/framework/capabilities/architecting-workload-placement/) calls for baseline, change tracking, outcome validation, and benefits realization against the business case.

## Documentation

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed. The connected ProdMind repository retains its repository-level Apache 2.0 license.
