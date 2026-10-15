# Roadmap Estimate Effectiveness Monitor

**ProdMind Project 46** closes the estimate-calibration loop. It verifies whether the estimate basis governed by Project 45 actually improved duration and capacity accuracy once Project 41 reports completed delivery.

The monitor is deterministic, evidence-linked, deployable on Cloudflare Workers, and requires no paid API or hosted model.

## Why this project exists

Project 44 derives reference-class factors. Project 45 checks that a schedule used those factors—or had an independently reviewed exception. Compliance alone is not effectiveness. Project 46 compares the approved base and calibrated estimates with observed outcomes, exposes regressions, and gives a named reviewer an explicit decision.

```text
Project 40 approved schedule ─┐
Project 41 completed delivery ├─> comparable outcomes ─> deterministic checks ─> human review
Project 45 estimate basis ────┘
```

## What it evaluates

- Exact item and report lineage across Projects 40, 41, and 45
- Completed delivery status
- Base versus calibrated duration error
- Base versus calibrated capacity error
- Minimum required error reduction
- Maximum accepted calibrated error
- Outcomes for approved exceptions
- Customer, adoption, and reviewed outcome evidence

The final state is `verified_effectiveness`, `blocked_retention`, or `action_required`. The system never changes a factor, estimate, schedule, or product decision.

## Architecture

| Layer | Responsibility |
|---|---|
| Deterministic engine | Validate bounded contracts, calculate errors and reductions, evaluate policy checks |
| Worker adapter | Enforce same-origin bearer auth, JSON-only requests, and a 2 MB body limit |
| Static UI | Show a safe sample evaluation in native light and dark themes |
| Connected workflow | Reconstruct Projects 40, 41, 44, and 45 before executing Project 46 |

Project 40 estimates are workdays, while Project 41 timestamps describe calendar elapsed time. Project 46 therefore requires a reviewed `actualDurationDays` value with evidence rather than silently comparing incompatible units.

## API

`POST /api/roadmap-estimate-effectiveness`

```json
{
  "runs": [],
  "scheduleReport": { "schemaVersion": "1.0.0", "status": "approved_schedule" },
  "deliveryReport": { "schemaVersion": "1.0.0", "items": [] },
  "adoptionReport": { "schemaVersion": "1.0.0", "status": "approved_estimate_basis" },
  "input": {
    "id": "effectiveness-2027-q1",
    "asOf": "2027-03-01T00:00:00Z",
    "maximumDurationErrorRate": 0.2,
    "maximumCapacityErrorRate": 0.2,
    "minimumErrorReductionRate": 0.05,
    "outcomes": [{
      "portfolioItemId": "run:onboarding",
      "actualDurationDays": 12,
      "evidence": "Reviewed workday record workdays-44."
    }],
    "review": {
      "reviewer": "Estimation council",
      "decision": "retain",
      "rationale": "Accuracy improved within policy.",
      "reviewedAt": "2027-03-01T01:00:00Z"
    }
  }
}
```

Use `Authorization: Bearer <API_TOKEN>`. Full upstream contracts are validated at runtime; abbreviated objects above only show the envelope.

## Run locally

```bash
npm install
npm test
npx wrangler dev
```

Create `.dev.vars` locally:

```text
API_TOKEN=replace-with-a-long-random-secret
```

Never commit `.dev.vars`. The demonstration UI sends requests only to its same-origin Worker.

## Deploy for free-tier use

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

The project uses Worker CPU plus static assets only. It has no database, model, analytics, or paid-service dependency. Cloudflare account limits still apply.

## Test coverage

The suite covers successful verification, tolerance failures, regression detection, exception outcomes, incomplete delivery, exact lineage, estimate reconciliation, chronology, reviewed-outcome evidence, human decisions, policy bounds, authentication, CORS, content type, and validation errors.

## Research basis

- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) — reliable estimating includes updating estimates with actual results and documenting the process.
- [U.S. Department of Energy Earned Value Management](https://www.energy.gov/em/earned-value-management) — compares actual cost and schedule performance with an approved baseline to support corrective action.
- [UK Infrastructure and Projects Authority benchmarking guidance](https://www.gov.uk/government/publications/best-practice-in-benchmarking) — uses comparable completed-project data to strengthen estimates and assurance.
- [NASA Cost Estimating Handbook](https://www.nasa.gov/offices/ocfo/ppc/cost-estimating-handbook/) — provides a structured estimating and continuous-learning reference.

These sources motivate the feedback loop. Project 46 is a portfolio prototype, not a certified cost-estimating, EVM, accounting, or causal-inference system.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Metrics and formulas](docs/METRICS.md)

## License

MIT
