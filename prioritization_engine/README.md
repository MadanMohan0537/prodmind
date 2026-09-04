<div align="center">

# ProdMind Prioritization Engine

**Turn product opportunities into transparent trade-offs and a capacity-aware portfolio.**

Explainable scoring · Monte Carlo uncertainty · Pareto analysis · Dependency-aware · Cloudflare-ready

![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-19%20passing-22c55e)
![Evaluation](https://img.shields.io/badge/evaluation-2%2F2%20passing-14b8a6)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../LICENSE)

</div>

Prioritization Engine is project 06 in [ProdMind](../README.md). It ranks product opportunities by balancing customer and business value, strategic alignment, confidence, technical feasibility, urgency, effort, risk, dependencies, and uncertainty.

The engine is designed for decision support rather than decision theater. It does not compress every assumption into an unexplained “AI score.” It exposes factor contributions, simulates uncertain inputs, identifies non-dominated opportunities, respects dependencies, and shows which portfolio fits the available capacity.

## At a glance

| | |
|---|---|
| **Users** | Product managers, founders, product operations, engineering leads, and portfolio reviewers |
| **Input** | Evidence-backed opportunities from discovery, research, analytics, and customer-feedback systems |
| **Output** | Ranked opportunities, score ranges, Pareto frontier, explanations, blockers, and selected portfolio |
| **Default runtime** | Browser-local dashboard or authenticated Cloudflare Worker API |
| **Persistence** | Optional Cloudflare D1 prioritization-run history |
| **Cost posture** | No paid model, solver, database, or analytics service is required |

## Product flow

```mermaid
flowchart TD
  A[Evidence-backed opportunities] --> B[Normalize decision inputs]
  B --> C[Transparent weighted score]
  C --> D[Monte Carlo uncertainty]
  C --> E[Pareto-front analysis]
  D --> F[Rank opportunities]
  E --> F
  F --> G[Resolve dependencies]
  G --> H[Capacity-aware portfolio]
  H --> I[Decision dashboard]
```

The browser and Worker share the same [`public/engine.js`](public/engine.js) implementation, preventing scoring drift between the local demo and deployed API.

## What is implemented

- Validated opportunity contract with bounded inputs
- Six normalized value factors with configurable weights
- Effort and risk modifiers
- Factor-level contribution explanations
- Seeded triangular Monte Carlo simulation
- P10, P50, P90, and mean score estimates
- Multi-objective Pareto-front detection
- Dependency validation and missing-dependency reporting
- Dependency-first capacity-aware portfolio selection
- Deterministic tie-breaking and reproducible results
- Browser-local JSON analysis
- Responsive system-aware light and dark interface
- Authenticated batch API for up to 500 opportunities
- Strict CORS allowlist, CSP, bounded payloads, and no-store responses
- Optional D1 run history
- Versioned JSON schemas, examples, tests, and evaluation harness

## Honest implementation status

| Capability | Status | Boundary |
|---|---|---|
| Transparent weighted scoring | Implemented | Configurable normalized weights |
| Uncertainty-aware ranking | Implemented | Seeded triangular Monte Carlo simulation |
| Multi-objective optimization | Implemented baseline | Exact Pareto-front detection; not NSGA-II |
| Dependency-aware selection | Implemented baseline | Greedy dependency-first capacity selection |
| Explainability | Implemented | Direct score contributions; not SHAP |
| Historical learning | Planned | No reinforcement-learning claims |
| Feature-dependency learning | Planned | Dependencies are explicit; no GNN claims |
| Enterprise constraints | Planned | No team allocation, calendar, or scenario solver yet |
| Production RBAC | Planned | Shared bearer token is a portfolio-demo boundary |

## Quick start

Requires Node.js 20 or newer.

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/prioritization_engine
npm install
npm test
npm run dev
```

Open the local URL printed by Wrangler and press **Load sample**. Browser-local analysis requires neither an API token nor a database.

## Opportunity contract

```json
{
  "id": "onboarding",
  "title": "Interactive onboarding checklist",
  "businessValue": 8,
  "userValue": 9,
  "strategicAlignment": 9,
  "confidence": 0.84,
  "feasibility": 0.82,
  "urgency": 8,
  "effort": 5,
  "risk": 0.18,
  "uncertainty": 0.16,
  "evidenceCount": 208,
  "dependencies": [],
  "tags": ["activation"],
  "owner": "Growth"
}
```

### Input scales

| Field | Scale | Meaning |
|---|---:|---|
| `businessValue` | 0–10 | Expected business contribution |
| `userValue` | 0–10 | Expected value to affected customers |
| `strategicAlignment` | 0–10 | Fit with explicit product strategy |
| `confidence` | 0–1 | Strength of supporting evidence |
| `feasibility` | 0–1 | Technical and operational achievability |
| `urgency` | 0–10 | Cost or risk of delay |
| `effort` | >0 | Relative delivery capacity required |
| `risk` | 0–1 | Delivery, compliance, or adoption risk |
| `uncertainty` | 0–0.75 | Input range used by simulation |

The versioned documentation contracts live under [`schema/`](schema/). Runtime validation is explicit JavaScript rather than dynamic JSON-Schema execution.

## Scoring model

Default value weights:

| Factor | Weight |
|---|---:|
| Business value | 25% |
| User value | 20% |
| Strategic alignment | 20% |
| Confidence | 15% |
| Feasibility | 10% |
| Urgency | 10% |

The normalized value score is adjusted by:

- An effort modifier relative to the batch’s median effort, bounded between `0.6` and `1.4`
- A risk modifier of `1 − risk × 0.35`

These defaults are a reviewable decision policy, not a universal truth. Teams should agree on definitions, ownership, calibration examples, and change control before using the ranking operationally.

## Monte Carlo uncertainty

Every opportunity is simulated between 100 and 5,000 times. Each value factor and effort is sampled from a triangular distribution whose mode is the entered estimate and whose width is controlled by `uncertainty`.

The output includes:

- **P10:** downside score
- **P50:** median planning score and primary rank
- **P90:** upside score
- **Mean:** average simulated score

The simulation uses an explicit seed plus the opportunity ID, making local, test, and API results reproducible. The intervals represent uncertainty in the entered assumptions; they are not statistically calibrated confidence intervals.

## Multi-objective and portfolio logic

An opportunity is Pareto-optimal when no other item is at least as good on value, confidence, feasibility, effort, and risk—and strictly better on at least one.

Portfolio selection then walks the ranked list and:

1. Resolves known dependencies first
2. Rejects items with missing dependencies
3. Adds work only when it fits remaining capacity
4. Returns selected IDs, used capacity, and remaining capacity

This greedy baseline is transparent and deterministic. It does not guarantee the globally optimal portfolio under complex constraints; a future optimizer should be benchmarked against it.

## API

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service, schema, and persistence status |
| `POST` | `/api/prioritize` | Bearer token | Prioritize up to 500 opportunities |
| `GET` | `/api/runs?limit=20` | Bearer token | Read D1 run-history summaries |

```bash
curl -X POST http://localhost:8787/api/prioritize \
  -H 'Authorization: Bearer local-development-token' \
  -H 'Content-Type: application/json' \
  --data @examples/sample-opportunities.json
```

## Cloudflare deployment

Create the optional D1 database:

```bash
npx wrangler d1 create prioritization-engine-db
```

Replace the placeholder ID in `wrangler.jsonc`, then configure and deploy:

```bash
npm run db:migrate:remote
npx wrangler secret put API_TOKEN
npm run deploy
```

Set `ALLOWED_ORIGINS` to the exact deployed browser origin. Remove the D1 binding for stateless API operation. For local authenticated requests, create an untracked `.dev.vars` file containing `API_TOKEN="local-development-token"`.

## Security and privacy

- Browser-local mode does not submit opportunity data.
- API access fails closed if `API_TOKEN` is absent.
- Cross-origin requests require an exact allowlisted origin.
- Bearer tokens are compared through fixed-length SHA-256 digests.
- Payload, batch, title, simulation, capacity, and history sizes are bounded.
- Responses include CSP, `nosniff`, no-referrer, and no-store headers.
- D1 statements are parameterized.
- Internal failures return a request identifier rather than implementation details.

D1 run history stores the complete prioritization result, including titles, descriptions, owners, scores, and dependencies. Before using real roadmap data, define access, retention, deletion, audit, and tenant-isolation policies. The shared bearer token is not sufficient for a public multi-tenant service.

## Testing and evaluation

```bash
npm run check
npm run evaluate
```

Current validation:

- **19/19 automated tests passing**
- **2/2 labeled evaluation cases passing**
- Deterministic simulation verified
- Strong opportunity outranks a weak comparison
- Pareto dominance verified
- Missing dependencies excluded
- Dependencies scheduled before dependent work
- Authentication, CORS, stateless API, and D1 boundary tested

The seed evaluation verifies expected behavior on designed examples. It does not prove that the default weights predict product outcomes. A production evaluation needs historical decisions, estimated-versus-realized value, calibration reviews, stability analysis, and decision-quality feedback.

## Repository structure

```text
public/engine.js        Shared scoring, simulation, Pareto, and portfolio logic
public/index.html       Accessible dashboard shell
public/app.js           Browser-local execution and result rendering
public/styles.css       Responsive system-aware light/dark interface
src/worker.js           Authenticated Worker API and optional persistence
migrations/             D1 run-history schema
schema/                 Opportunity and result contracts
examples/               Ready-to-run opportunity portfolio
evaluation/             Labeled ranking and dependency cases
scripts/evaluate.js     Evaluation runner
test/                   Engine and Worker-route tests
wrangler.jsonc          Cloudflare configuration
```

## Integration with ProdMind

- **Feedback Collector** creates normalized evidence.
- **Sentiment Analyzer**, **Topic Modeler**, and **Feature Request Detector** enrich it.
- **Voice-of-Customer Dashboard** exposes patterns and emerging problems.
- **Prioritization Engine** evaluates opportunities created from that evidence alongside strategy, feasibility, effort, risk, and uncertainty.

Feedback volume is evidence strength—not business value. Classifier confidence is not prioritization confidence. Upstream AI signals should inform explicit product judgment rather than silently determine the roadmap.

## Honest limitations

- Default weights and scales require team calibration.
- Estimates remain subjective even when the math is transparent.
- Monte Carlo inputs are triangular assumptions, not learned distributions.
- Pareto analysis can return many items when objectives conflict.
- The greedy portfolio selector is not a global constraint optimizer.
- Explicit dependencies do not discover hidden architecture relationships.
- No historical-outcome learning, NSGA-II, GNN, reinforcement learning, or SHAP implementation is claimed.
- D1 history does not yet support versioned decision comparisons or approvals.
- The API has no user identity, RBAC, tenant isolation, or distributed abuse controls.

## Roadmap

1. Add decision-policy presets with versioned calibration examples.
2. Add scenario comparison and weight-sensitivity analysis.
3. Add team, quarter, skill, and must-do constraints.
4. Benchmark an exact integer-programming portfolio solver against the greedy baseline.
5. Add decision review, overrides, rationale, and realized-outcome tracking.
6. Train only on sufficiently complete historical decisions and compare with the deterministic baseline.
7. Evaluate NSGA-II when the constraint space justifies evolutionary optimization.
8. Add tenant identity, RBAC, audit logs, and retention controls before multi-tenant use.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
