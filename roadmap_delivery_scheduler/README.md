# Evidence-linked Product Roadmap Delivery Scheduler

**ProdMind Project 40 turns the selected Project 14 portfolio into an executable, evidence-linked delivery calendar without changing the roadmap or silently assigning people.**

The existing portfolio projects decide _what_ deserves investment and how the portfolio should rebalance. Project 40 closes the execution-planning gap: it places approved work on declared team calendars while respecting dependencies, capacity, earliest starts, deadlines, and non-working days.

## What it answers

> Can every selected portfolio item fit into the declared delivery horizon without breaking dependencies, exceeding team capacity, or missing a deadline?

The answer is one of:

- `approved_schedule` — every deterministic check passed and a named human approved;
- `blocked_approval` — approval was requested, but portfolio alignment, deadlines, dependency order, or evidence lineage failed;
- `action_required` — a named human chose `revise` or `defer`.

The scheduler never changes portfolio selection, assigns individual people, invents estimates, predicts delivery probability, or deploys work. Its critical path is dependency-only and explicitly excludes resource contention, calendars, and duration uncertainty.

## Connected workflow

```text
Projects 1–13 evidence, validation and investment inputs
                         ↓
Project 14 selected or rebalanced portfolio
                         ↓
Declared teams, calendars, estimates and deadlines
                         ↓
Project 40 exact bounded scheduling engine
                         ↓
approved_schedule | blocked_approval | action_required
                         ↓
Named human approve | revise | defer decision
```

Every scheduled row retains `runId`, `opportunityId`, `portfolioItemId`, and customer `evidenceIds`, so delivery dates remain traceable to the original product evidence.

## Deterministic method

For at most eight selected items, the engine enumerates every dependency-valid priority order. Each candidate uses earliest feasible, non-preemptive placement against:

1. item dependencies;
2. item earliest-start dates;
3. team capacity;
4. global working weekdays and holidays;
5. team-specific non-working dates;
6. a bounded scheduling horizon.

Candidates are ranked lexicographically by missed deadlines, total late days, makespan, then stable item order. The result is therefore repeatable and optimal within the documented search bound. A separate CPM calculation reports dependency-only float and labels its limitation.

## API

`POST /api/roadmap-schedule`

```json
{
  "runs": [],
  "portfolioReport": {
    "schemaVersion": "1.1.0",
    "status": "aligned",
    "selected": [
      {
        "portfolioItemId": "run-42:onboarding",
        "runId": "run-42",
        "opportunityId": "onboarding",
        "title": "Improve first-run activation",
        "score": 8.7,
        "effort": 3,
        "dependencies": [],
        "evidenceIds": ["ticket-184", "interview-22"]
      }
    ]
  },
  "input": {
    "id": "roadmap-q1-2027",
    "asOf": "2027-01-03T12:00:00Z",
    "horizonStart": "2027-01-04",
    "maximumHorizonDays": 90,
    "workingWeekdays": [1, 2, 3, 4, 5],
    "nonWorkingDates": ["2027-01-18"],
    "teams": [
      { "id": "growth", "name": "Growth", "capacity": 2, "nonWorkingDates": [] }
    ],
    "plans": [
      {
        "portfolioItemId": "run-42:onboarding",
        "teamId": "growth",
        "durationDays": 5,
        "capacity": 2,
        "earliestStart": "2027-01-04",
        "deadline": "2027-01-15",
        "owner": "Growth PM",
        "outcome": "Increase first-week activation without harming support load.",
        "estimateBasis": "Reviewed against two comparable onboarding releases."
      }
    ],
    "review": {
      "reviewer": "Portfolio council",
      "decision": "approve",
      "rationale": "Capacity, dependencies, dates and evidence are reviewable.",
      "reviewedAt": "2027-01-03T12:00:00Z"
    }
  }
}
```

Requests require `Content-Type: application/json` and `Authorization: Bearer <API_TOKEN>`. The Worker fails closed when the secret is absent and rejects cross-origin API calls, payloads over 2 MB, malformed dates, duplicate identities, dependency cycles, missing selected-item plans, unknown teams, and out-of-horizon work.

## Run and deploy

```bash
npm install
npm test
npx wrangler dev
```

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

There are no runtime packages, paid APIs, model calls, databases, or background services. The Worker and static light/dark interface can operate inside Cloudflare's free allowances, subject to Cloudflare's current account limits.

## Repository map

```text
roadmap_delivery_scheduler/
├── docs/                 # PRD, architecture and metrics
├── public/               # Responsive light/dark review interface
├── src/                  # Deterministic scheduler and Worker API
├── tests/                # Engine and HTTP boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [GAO Schedule Assessment Guide](https://www.gao.gov/products/gao-16-89g) describes integrated scheduling, critical path, total float, and schedule risk analysis.
- [GOV.UK agile delivery guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works) grounds planning in user needs and a team-owned roadmap rather than a fixed feature promise.
- [Google OR-Tools job-shop guide](https://developers.google.com/optimization/scheduling/job_shop) demonstrates deterministic precedence, exclusive-resource, and makespan constraints.
- [Google OR-Tools CP-SAT overview](https://developers.google.com/optimization/cp/cp_solver) motivates bounded constraint optimization while this implementation remains dependency-free.

These sources inform the design. A passing report is not proof of delivery certainty, GAO compliance, or schedule-risk analysis.

## License

[MIT](LICENSE)
