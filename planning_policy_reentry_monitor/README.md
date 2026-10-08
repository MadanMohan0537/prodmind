# Product Planning Policy Re-entry Assurance Monitor

**ProdMind Project 39 turns an approved post-incident re-entry into a monitored, bounded, evidence-backed human decision.**

Project 38 decides whether incident learning, corrective actions, cooling time, and independent approvals make a new policy trial eligible to begin. Eligibility is not execution assurance. Project 39 checks whether the actual re-entry remained inside that approval and whether the incident-specific controls continued to work during exposure.

## What it answers

> Did the post-incident policy re-entry follow the approved baseline, scope, stages, controls, recurrence monitors, guardrails, and observation requirements closely enough for a human to continue it?

The answer is one of:

- `verified_reentry` — every deterministic check passed and a human chose `continue`;
- `blocked_continue` — a human selected `continue`, but at least one control failed;
- `action_required` — a human selected `pause` or `refreeze`.

The monitor never starts or expands a trial, changes policy, pauses traffic, refreezes a policy, assigns blame, or claims that the re-entry caused an observed result.

## Connected workflow

```text
Project 37 verified recovery
            ↓
Project 38 incident learning and re-entry approval
            ↓
Pre-exposure declaration and bounded stages
            ↓
Corrective-control, recurrence and guardrail observations
            ↓
Project 39 deterministic assurance checks
            ↓
verified_reentry | blocked_continue | action_required
            ↓
Named human continue | pause | refreeze decision
```

Project 39 preserves lineage back through the recovery review, effectiveness review, rollout, policy change, outcome review, experiment, and policy.

## Deterministic controls

The engine verifies:

1. Project 38 returned `ready_for_reentry` with an `approve_reentry` decision.
2. The trial declaration was recorded after approval and before exposure.
3. Owner, recovered baseline, and scope stay within the Project 38 approval.
4. Planned exposure stages increase monotonically and remain under a human-defined ceiling.
5. Execution matches the declared sequence, exposure, dwell time, and maximum inter-stage gap.
6. Every stage contains evidence-backed observations.
7. Every observation meets the declared minimum sample size.
8. Every completed P0/P1 corrective action remains operational in every observation.
9. Every incident contributing condition has a recurrence monitor.
10. At least one guardrail is observed, and no recurrence or guardrail threshold is breached.
11. The complete observation window elapses before review.
12. A named human records `continue`, `pause`, or `refreeze`.

Threshold comparison is explicit: `above` breaches only when `value > threshold`; `below` breaches only when `value < threshold`.

## API

`POST /api/planning-policy-reentry-assurance`

```json
{
  "runs": [],
  "learningReport": {"schemaVersion": "1.0.0", "incidentLearningReviews": []},
  "input": {
    "asOf": "2027-10-22T00:00:00Z",
    "minimumObservationHours": 24,
    "maximumStageGapHours": 1,
    "maximumExposurePercent": 20,
    "minimumSampleSize": 50,
    "trials": []
  }
}
```

Requests require `Content-Type: application/json` and `Authorization: Bearer <API_TOKEN>`. The Worker rejects cross-origin API calls, bodies larger than 2 MB, missing secrets, invalid lineage, unbounded arrays, duplicate identities, and malformed timestamps.

## Run locally

```bash
npm install
npm test
npx wrangler dev
```

Set the secret before deployment:

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

The project uses no paid APIs, model calls, database, or runtime package. Cloudflare static assets and the Worker API share one origin.

## Repository map

```text
planning_policy_reentry_monitor/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   └── PRD.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── assurance.js
│   └── worker.js
├── tests/
│   ├── assurance.test.js
│   └── worker.test.js
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) integrates incident response and recovery into organizational risk management.
- [NIST SP 800-184](https://csrc.nist.gov/pubs/sp/800/184/final) emphasizes recovery planning, testing, metrics, and improvement using lessons from prior events.
- [Google SRE: Canarying Releases](https://sre.google/workbook/canarying-releases/) recommends partial, time-limited exposure, control comparisons, suitable monitoring intervals, and rollback when canary signals diverge.
- [Google SRE: Twenty Years of Lessons Learned](https://sre.google/resources/practices-and-processes/twenty-years-of-sre-lessons-learned/) recommends testing recovery mechanisms and canarying changes.

These sources inform the controls; passing them is not proof of NIST compliance, SRE maturity, safety, or causality.

## License

[MIT](LICENSE)

