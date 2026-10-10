# Roadmap Delivery Execution & Variance Monitor

**ProdMind Project 41 compares Project 40’s approved roadmap schedule with actual delivery evidence before a human continues, replans, or escalates.**

Project 40 answers whether selected work can fit into a declared calendar. A feasible baseline does not show whether execution remains healthy. Project 41 closes that loop with chronological snapshots of completed work, consumed capacity, actual dates, blockers, and evidence.

## What it answers

> Is the approved roadmap being delivered within its baseline, dependencies, deadlines, capacity tolerance, and reporting cadence?

The answer is one of:

- `controlled_delivery` — every deterministic check passed and a named human chose `continue`;
- `blocked_continue` — continuation was requested while at least one control failed;
- `action_required` — a named human chose `replan` or `escalate`.

The monitor never changes the roadmap, assigns people, closes blockers, updates work, evaluates employees, or predicts delivery probability. Its work and capacity indices are descriptive controls, not a certified Earned Value Management System.

## Connected workflow

```text
Project 14 selected portfolio
             ↓
Project 40 approved schedule baseline
             ↓
Chronological delivery snapshots
             ↓
Planned work vs earned work vs consumed capacity
             ↓
Dependencies + deadlines + blockers + cadence
             ↓
Project 41 deterministic controls
             ↓
controlled_delivery | blocked_continue | action_required
             ↓
Named human continue | replan | escalate decision
```

Every monitored item retains its `runId`, `opportunityId`, `portfolioItemId`, Project 40 schedule ID, and customer `evidenceIds`.

## Deterministic controls

1. Require an `approved_schedule` Project 40 baseline.
2. Validate complete, strictly chronological snapshots for every scheduled item.
3. Prevent completed work, consumed capacity, and actual dates from regressing.
4. Time-phase planned work using the baseline’s scheduled work dates.
5. Compare declared earned work with planned work through a visible schedule performance index.
6. Compare consumed capacity-days with earned work and a declared overrun tolerance.
7. Check actual starts against completed dependencies.
8. Detect missed deadlines and late completed work.
9. Require owned, evidenced blockers and detect overdue blocker dates.
10. Enforce minimum snapshot coverage, maximum reporting gaps, and freshness.
11. Require current delivery evidence while retaining original customer evidence.
12. Keep `continue`, `replan`, and `escalate` as named human decisions.

## API

`POST /api/roadmap-delivery`

```json
{
  "runs": [],
  "scheduleReport": {
    "schemaVersion": "1.0.0",
    "id": "roadmap-q1-2027",
    "asOf": "2027-01-03T18:00:00Z",
    "status": "approved_schedule",
    "schedule": []
  },
  "input": {
    "id": "delivery-q1-2027",
    "asOf": "2027-01-15T20:00:00Z",
    "minimumSnapshots": 2,
    "maximumSnapshotGapDays": 7,
    "minimumSchedulePerformanceIndex": 0.9,
    "maximumCapacityOverrunRate": 0.2,
    "snapshots": [
      {
        "id": "week-2",
        "observedAt": "2027-01-15T18:00:00Z",
        "items": [
          {
            "portfolioItemId": "run-42:onboarding",
            "status": "in_progress",
            "completedWorkUnits": 6,
            "actualCapacityDays": 7,
            "remainingEstimateDays": 2,
            "actualStart": "2027-01-04",
            "actualFinish": null,
            "evidence": "Reviewed delivery board export 2027-01-15.",
            "blockers": []
          }
        ]
      }
    ],
    "review": {
      "reviewer": "Delivery council",
      "decision": "continue",
      "rationale": "Delivery evidence and controls remain within tolerance.",
      "reviewedAt": "2027-01-15T19:00:00Z"
    }
  }
}
```

`completedWorkUnits` uses the Project 40 baseline’s capacity-day unit: `durationDays × capacity`. It is a declared, evidenced observation. The system does not infer percent complete from activity or prose.

Requests require `Content-Type: application/json` and `Authorization: Bearer <API_TOKEN>`. The Worker fails closed without its secret and rejects cross-origin API calls, bodies over 2 MB, malformed dates, incomplete snapshots, unknown work, inconsistent states, decreasing observations, and invalid thresholds.

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

There are no runtime packages, paid APIs, model calls, databases, or background services. The Worker and static light/dark interface can operate inside Cloudflare’s free allowances, subject to Cloudflare’s current account limits.

## Repository map

```text
roadmap_delivery_monitor/
├── docs/                 # PRD, architecture and metrics
├── public/               # Responsive light/dark review interface
├── src/                  # Deterministic monitor and Worker API
├── tests/                # Engine and HTTP boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [GAO Schedule Assessment Guide](https://www.gao.gov/products/gao-16-89g) recommends maintaining a baseline and updating schedules using actual progress and network logic.
- [U.S. Department of Energy: Earned Value Management](https://www.energy.gov/projectmanagement/earned-value-management) describes integrating and measuring scope, schedule, and actual performance against an approved baseline.
- [UK Government delivery-manager capability](https://understand-digital-data-roles-skills.service.gov.uk/role/delivery-manager/) includes tracking, managing, escalating, and communicating dependencies.
- [Government Functional Standard GovS 005](https://www.gov.uk/government/publications/government-functional-standard-govs-005-digital/government-functional-standard-govs-005-digital-html) emphasizes performance, delivery risk, and portfolio dependencies.

These sources inform the controls. A passing report is not proof of GAO compliance, DOE EVMS conformity, causal impact, or future on-time delivery.

## License

[MIT](LICENSE)
