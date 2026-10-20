# Roadmap Recalibration Incident Learning & Re-entry Controller

Project 51 prevents a verified rollback from becoming the end of learning. After Project 50 proves that the prior estimate policy was restored and stable, this project decides whether a different recalibration candidate is safe to re-enter shadow evaluation.

## Why it belongs in ProdMind

Projects 48–50 control proposal validation, staged rollout, rollback, and recovery. They do not require a post-incident record, completed corrective actions, a cooling period, or approval for a new attempt. Project 51 closes that governance gap.

```text
48 approved recalibration → 49 staged rollout → rollback
    → 50 verified recovery → 51 learning + controlled re-entry
```

## Deterministic controls

- Exact Project 50 recovery, Project 49 rollout, and Project 48 recalibration lineage
- Verified recovery and explicit human closure
- Timely post-incident publication and chronological evidenced timeline
- Blameless, evidence-backed system conditions and lessons
- Owned preventive and detective corrective actions
- Completed P0/P1 and re-entry-required actions, with no overdue work
- Cooling period and declared freeze
- Recovered baseline and reference-class scope
- A genuinely new candidate version
- Required shadow stage and bounded initial exposure
- Predeclared rollback and duration, capacity, and incident monitors
- Independent Product, Delivery, and Assurance approvals
- Named human `approve_reentry`, `continue_freeze`, or `escalate` decision

`approve_reentry` yields `ready_for_reentry` only when every gate passes. Failed gates produce `blocked_reentry`; the other decisions remain `action_required`.

## Architecture

| Layer | Responsibility |
|---|---|
| Deterministic engine | Validate lineage, learning, actions, cooling, scope, candidate, exposure, rollback, monitoring, and approvals |
| Worker API | Authenticate, reject cross-origin API calls, cap bodies, and return no-store JSON |
| Static workbench | Provide an accessible system-aware light/dark review interface |
| Connected workflow | Reconstruct Projects 14 and 40–50 server-side before Project 51 assessment |

No LLM performs the decision and no paid service or runtime dependency is required.

## API

`POST /api/roadmap-recalibration-reentry`

```json
{
  "recoveryReport": { "schemaVersion": "1.0.0", "status": "verified_recovery" },
  "input": {
    "id": "learning-1",
    "asOf": "2027-03-21T00:00:00Z",
    "maximumPublicationDays": 7,
    "minimumCoolingDays": 14,
    "maximumInitialExposureRate": 0.1,
    "publishedAt": "2027-03-18T00:00:00Z",
    "timeline": [],
    "contributingConditions": [],
    "lessons": [],
    "actions": [],
    "reentry": {},
    "approvals": [],
    "review": {}
  }
}
```

Send `Authorization: Bearer <API_TOKEN>` and `Content-Type: application/json`. The test fixture documents the complete field contract.

## Run and deploy

```bash
npm test
npm run check
npx wrangler dev
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Research basis

- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) integrates incident response and recovery into risk management and continual improvement.
- [Google SRE Postmortem Culture](https://sre.google/sre-book/lessons-learned/) emphasizes blameless investigation, recurrence prevention, and owned corrective actions.
- [NIST AI RMF Playbook — Manage](https://airc.nist.gov/airmf-resources/playbook/manage/) calls for documented, monitored response, recovery, post-deployment monitoring, override, and change-management plans.

## Boundaries

This controller does not lift a freeze, start a rollout, activate factors, edit estimates, assign blame, prove causality or statistical significance, or approve its own re-entry. It assesses the supplied record against declared controls and preserves the human decision.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed.
