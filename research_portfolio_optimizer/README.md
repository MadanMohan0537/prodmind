<div align="center">

# Project 12: Product Research Portfolio Optimizer

**Choose the strongest feasible research plan for the evidence gaps that matter most.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 11 can reveal stale, concentrated, narrow, polarized, or disconnected evidence. That still leaves a practical PM problem: the research team cannot investigate every gap at once.

Project 12 converts those findings into a research backlog and selects the combination that covers the most important evidence risk within available capacity. The result is deterministic, inspectable, and connected to the original opportunity and finding identities.

## Place in ProdMind

```text
Projects 1–5: evidence collection and discovery
              ↓
Project 11: evidence-integrity findings
              ↓
Project 12: capacity-aware research portfolio
              ↓
Fresh evidence returns to Projects 1–5
              ↓
Projects 6–10: decisions, outcomes, memory and calibration
```

This is the closing loop between detecting an evidence problem and deciding what to research next.

## What is implemented

- Converts Project 11 finding codes into traceable research actions
- Supports custom action catalogs and effort estimates
- Uses visible priority weights: blocker `8`, high `5`, medium `3`, review `1`
- Maximizes unique finding coverage within a capacity constraint
- Prevents double counting when actions cover the same finding
- Enforces action dependencies
- Uses deterministic tie-breaking by value, effort, action count, and subset order
- Returns selected actions plus uncovered evidence gaps
- Reports the number of combinations evaluated
- Makes an exact optimality claim only within the bounded action catalog
- Preserves opportunity IDs, finding codes, severities, and source messages
- Provides an authenticated Cloudflare Worker and light/dark frontend
- Runs directly inside the connected Project 7 workspace
- Requires no paid model, solver, or external database

## Optimization model

For each research action `i`, the optimizer chooses binary variable `xᵢ`.

```text
maximize   unique priority weight of covered findings
subject to Σ effortᵢ × xᵢ ≤ available capacity
           selected dependencies must also be selected
           xᵢ ∈ {0, 1}
```

The MVP enumerates every feasible subset for at most 16 actions. That limit keeps the Cloudflare workload bounded at a maximum of 65,536 combinations and lets the system truthfully report an exact optimum for the admitted catalog. Automatically derived backlogs admit the 16 highest-severity actions and return the remainder as `deferredCatalogActions`; custom catalogs larger than 16 are rejected. It does not claim that the action catalog or human effort estimates are objectively correct.

## Default research actions

| Project 11 finding | Suggested response | Default effort |
|---|---|---:|
| Broken lineage | Repair or explicitly retire source identifiers | 1 |
| Unknown segments | Correct source metadata without guessing | 1 |
| Source gap | Validate through an independent channel | 2 |
| Source concentration | Sample an underrepresented channel | 2 |
| Polarized signal | Compare segments, channels, and contexts | 2 |
| Stale evidence | Run a focused current research round | 3 |
| Small sample | Collect more observations under the same protocol | 3 |
| Segment gap | Recruit an underrepresented relevant segment | 3 |

Effort is an abstract unit. A team must define whether one unit means a researcher-day, sprint point, or another consistent measure.

## API

### Health

```http
GET /api/health
```

### Optimize

```http
POST /api/optimize
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

```json
{
  "integrity": {
    "assessments": []
  },
  "capacity": 8
}
```

Omit `actions` to derive the default backlog. Supply an `actions` array to use reviewed effort, coverage, and dependency assumptions.

The connected workspace exposes `GET /api/research-plan?capacity=8`. It reads recent D1-backed runs, executes Project 11, derives the backlog, and executes Project 12 without a network hop.

## Run locally

```bash
cd research_portfolio_optimizer
npm install
npm run check
npm run dev
```

Create `.dev.vars` locally:

```text
API_TOKEN=replace-with-a-long-random-secret
```

## Deploy

```bash
npx wrangler secret put API_TOKEN
npm run deploy
```

## Structure

```text
research_portfolio_optimizer/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   └── PRD.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── optimizer.js
│   └── worker.js
├── tests/
│   └── optimizer.test.js
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Honest limits

- The mathematical optimum is only as good as the submitted action catalog, priorities, dependencies, and effort estimates.
- Covering a finding means scheduling a response, not proving the evidence problem has been resolved.
- Default research actions are templates requiring researcher review.
- The optimizer does not schedule calendar dates or assign individual researchers.
- It does not estimate recruitment feasibility, statistical power, or research ethics requirements.
- Sixteen actions is a deliberate exact-search bound, not an enterprise-scale solver claim.
- Results do not automatically change prioritization or approve product work.

## Research basis

- [GOV.UK: plan user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service)
- [GOV.UK: capture research questions](https://www.gov.uk/service-manual/user-research/capturing-research-questions)
- [Google OR-Tools: constraint optimization](https://developers.google.com/optimization/cp)
- [Google OR-Tools: CP-SAT](https://developers.google.com/optimization/cp/cp_solver)
- [Google OR-Tools overview](https://developers.google.com/optimization/introduction)

The current JavaScript engine is a bounded exhaustive solver, not an OR-Tools wrapper. OR-Tools is a documented upgrade path when action catalogs exceed the exact-search limit.

## License

[MIT](LICENSE)
