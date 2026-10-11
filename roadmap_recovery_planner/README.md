# Roadmap Delivery Recovery Action Planner

**ProdMind Project 42 turns failed Project 41 delivery controls into a bounded, evidence-linked corrective-action scenario for named human review.**

Project 40 creates an approved delivery baseline. Project 41 compares that baseline with actual delivery. Project 42 closes the response gap: it evaluates declared recovery actions without rewriting either source report or implying that planning equals execution.

## What it answers

> Given current delivery variance and limited recovery capacity, which declared actions cover the most important failed controls with the least baseline disruption?

The output is one of:

- `approved_recovery_plan` — every deterministic check passed and a named human approved the scenario;
- `blocked_approval` — approval was requested but coverage or another control failed;
- `action_required` — a named human chose `revise` or `defer`.

The planner never edits a roadmap, changes scope or deadlines, assigns people, resolves blockers, or executes actions. It does not forecast delivery or claim root cause.

## Connected workflow

```text
Project 14 selected portfolio
             ↓
Project 40 approved delivery baseline
             ↓
Project 41 actual delivery controls
             ↓
Failed checks + declared recovery candidates
             ↓
Project 42 exact bounded selection
             ↓
approved_recovery_plan | blocked_approval | action_required
             ↓
Named human approve | revise | defer decision
```

Every selected action retains the Project 40 schedule ID, Project 41 monitor ID, canonical `portfolioItemId` values, and original customer `evidenceIds`.

## Deterministic decision model

The planner evaluates every non-empty subset of at most 16 candidates—up to 65,535 combinations. A subset is feasible only when it fits declared recovery capacity and contains every selected action's prerequisites.

It then:

1. maximizes unique severity-weighted failed-control coverage;
2. minimizes baseline-changing actions;
3. minimizes irreversible actions;
4. minimizes effort;
5. prefers the earlier latest due date;
6. minimizes action count.

Visible severity weights prioritize schedule approval, dependency, deadline, and evidence integrity without calling them probabilities. Candidate types can target only compatible failed checks. `scope_decision` and `deadline_decision` actions must explicitly declare that formal baseline change would be required.

## Candidate contract

Each candidate requires:

- stable ID, type, title, and owner;
- failed Project 41 target checks;
- affected canonical portfolio items;
- effort and due date;
- candidate dependencies;
- baseline-change and reversibility declarations;
- rationale, exit criteria, and planning evidence.

Supported types are `schedule_repair`, `capacity_adjustment`, `dependency_recovery`, `blocker_resolution`, `evidence_remediation`, `scope_decision`, and `deadline_decision`.

## API

`POST /api/roadmap-recovery`

The following is an abridged envelope; replace the placeholder source arrays with complete Project 40 and Project 41 reports.

```json
{
  "runs": [],
  "scheduleReport": { "schemaVersion": "1.0.0", "id": "roadmap-1", "schedule": [] },
  "deliveryReport": { "schemaVersion": "1.0.0", "id": "delivery-1", "sourceScheduleId": "roadmap-1", "checks": [], "items": [] },
  "input": {
    "id": "recovery-1",
    "asOf": "2027-01-13T12:00:00Z",
    "horizonEnd": "2027-02-28",
    "capacityDays": 10,
    "minimumCoverageRate": 0.8,
    "candidates": [{
      "id": "resolve-handoff",
      "type": "capacity_adjustment",
      "title": "Reduce delivery handoff load",
      "owner": "Delivery lead",
      "targetCheckIds": ["schedule-performance", "capacity-variance"],
      "portfolioItemIds": ["run-42:onboarding"],
      "effortDays": 3,
      "dueAt": "2027-01-20",
      "dependencies": [],
      "changesBaseline": false,
      "reversible": true,
      "rationale": "Reviewed queues show handoff work consuming delivery capacity.",
      "exitCriteria": "Both controls pass in the next delivery snapshot.",
      "evidence": "Reviewed delivery and capacity logs dated 2027-01-12."
    }],
    "review": {
      "reviewer": "Roadmap council",
      "decision": "approve",
      "rationale": "The bounded action covers the failed controls.",
      "reviewedAt": "2027-01-13T13:00:00Z"
    }
  }
}
```

Requests require `Content-Type: application/json` and `Authorization: Bearer <API_TOKEN>`. The Worker fails closed without its secret and rejects cross-origin API requests, bodies over 2 MB, incompatible targets, unknown work, dependency cycles, invalid chronology, and inputs outside bounded search limits.

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

There are no runtime packages, databases, model calls, paid APIs, or background services. Cloudflare free allowances remain subject to Cloudflare's current account limits.

## Repository map

```text
roadmap_recovery_planner/
├── docs/                 # PRD, architecture and metrics
├── public/               # Responsive light/dark review interface
├── src/                  # Deterministic planner and Worker API
├── tests/                # Decision engine and HTTP boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [GAO Schedule Assessment Guide](https://www.gao.gov/products/gao-16-89g) distinguishes routine schedule updates from formal replanning and recommends retaining baseline integrity.
- [U.S. Department of Energy EVMS surveillance guidance](https://www.energy.gov/sites/prod/files/OECM_EVMS_SSOP_FNL_26Sep2011.pdf) calls for variance explanation, impact, corrective action or recovery plans, and higher-level approval.
- [U.S. Department of Energy Earned Value Management](https://www.energy.gov/em/earned-value-management) describes early problem identification, corrective action, and replanning when necessary.
- [GOV.UK Gate 2 Delivery Strategy](https://www.gov.uk/government/publications/gate-review-2-delivery-strategy/gate-2-review-delivery-strategy) calls for processes addressing deviations from plans and timetables within a rigorous governance framework.

These sources inform the product controls. A passing report does not establish GAO compliance, DOE EVMS conformity, delivery certainty, or causal effectiveness.

## License

[MIT](LICENSE)
