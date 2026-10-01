# Product Planning Policy Experiment Planner

**Project 32 of ProdMind turns Project 31 calibration gaps into reversible, capacity-feasible planning-policy experiments.**

Measurement only improves a product operating system when a team can act on it safely. This zero-paid-service Cloudflare Workers project derives targets from failed calibration checks, validates candidate policy trials, and uses exact bounded optimization to cover the most important gaps within declared change capacity. Every trial has an owner, hypothesis, success measure, guardrail, rollback plan, observation window, and named human decision.

It never changes policy, edits estimates, assigns people, claims causality, or treats transparent risk points as probabilities.

```text
Project 31 calibration gaps + reversible experiment candidates
                              ↓
gap validation + dependency checks + exact capacity optimization
                              ↓
approved | blocked_approval | action_required | no_gaps
                              ↓
named human approves, revises, or defers prospective trials
```

## What it adds

- A controlled action layer after Project 31 measurement.
- Targets derived only from failed sample, evidence, observation, effort, delivery, effectiveness, or recurrence checks.
- Exact selection across at most 16 candidates and 65,536 subsets.
- Unique weighted coverage without double counting.
- Dependency and capacity enforcement.
- Mandatory reversibility, guardrails, review timing, success criteria, and accountable ownership.
- Preserved Project 30 outcome-review lineage through the Project 31 report.

## Run locally

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

The standalone endpoint is `POST /api/planning-policy-experiments`. The responsive frontend follows the operating system’s light or dark preference. The Worker uses no database, model, paid API, framework, or third-party runtime dependency.

## Connected boundary

Standalone use accepts a Project 31 report plus policy candidates. In the connected ProdMind workflow, Project 7 reconstructs Projects 18–31 server-side and only accepts raw lifecycle inputs and candidate policy trials. This prevents a caller from replacing the current calibration result.

An approved output is permission to conduct the declared experiments—not proof that a policy should become permanent. Execution, adoption, labor implications, causal evaluation, and later policy ratification remain human responsibilities.

## Research basis

- [NIST SP 800-55 Volumes 1 and 2](https://csrc.nist.gov/News/2024/nist-releases-volumes-1-and-2-of-sp-800-55) connect measures, data quality, uncertainty, reporting, and continuous improvement.
- [NIST’s process-control guidance](https://www.itl.nist.gov/div898/handbook/pmc/section1/pmc12.htm) compares current performance with a historical model and investigates meaningful departures rather than treating every observation as a permanent change.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) incorporates lessons learned and improvement into ongoing risk management.
- [GAO’s Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) recommends updating estimates with actual results while documenting assumptions and uncertainty.

These sources inform the learning and control boundaries; this project is not a compliance, audit, or statistical-inference product.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.
