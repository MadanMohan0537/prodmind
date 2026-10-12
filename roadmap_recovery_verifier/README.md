# Roadmap Recovery Execution & Effectiveness Verifier

**ProdMind Project 43 verifies that Project 42 recovery actions were executed as approved and that the originally failed Project 41 controls subsequently recovered.**

Project 42 creates a bounded action scenario. Project 43 prevents the workflow from treating approval—or even task completion—as proof of recovery. It requires action-level execution and exit evidence plus a later Project 41 control report.

## What it answers

> Were the approved recovery actions completed within their dates and effort tolerance, and did every original failed delivery control recover after a sufficient observation period?

The result is:

- `verified_recovery` — all deterministic checks passed and a named human chose `close`;
- `blocked_close` — closure was requested while at least one check failed;
- `action_required` — a named human chose `continue_monitoring` or `escalate`.

The verifier never executes an action, changes the baseline, updates work, or closes recovery automatically.

## Connected architecture

```text
Project 40 approved schedule
             ↓
Project 41 failed delivery controls
             ↓
Project 42 approved recovery actions
             ↓
Action outcomes + later Project 41 controls
             ↓
Project 43 deterministic verification
             ↓
verified_recovery | blocked_close | action_required
             ↓
Named human close | continue monitoring | escalate
```

The Project 7 endpoint reconstructs Projects 14, 40, 41, and 42 server-side before invoking Project 43.

## Deterministic controls

1. Require an `approved_recovery_plan` linked to the same schedule and baseline delivery report.
2. Require exactly one outcome for every selected action.
3. Validate completion state and chronology.
4. Check completion against the declared due date.
5. Compare actual effort with planned effort and a declared tolerance.
6. Require execution and exit evidence.
7. Require prior approval for every completed baseline-changing action.
8. Enforce the minimum observation period after the latest completion.
9. Reassess every originally failed control in a later Project 41 report.
10. Preserve original customer-evidence and work-item lineage.
11. Block human closure when any control fails.

## API

`POST /api/roadmap-recovery-verification`

The request contains `runs`, `scheduleReport`, `baselineDeliveryReport`, `recoveryPlanReport`, `followupDeliveryReport`, and:

```json
{
  "input": {
    "id": "verification-1",
    "asOf": "2027-01-28T12:00:00Z",
    "minimumObservationDays": 7,
    "maximumEffortVarianceRate": 0.25,
    "actionOutcomes": [{
      "actionId": "restore-sequence",
      "status": "completed",
      "completedAt": "2027-01-20T18:00:00Z",
      "actualEffortDays": 2,
      "executionEvidence": "Change record 42 confirms implementation.",
      "exitEvidence": "The later delivery review passed the target control."
    }],
    "review": {
      "reviewer": "Roadmap council",
      "decision": "close",
      "rationale": "Execution and follow-up controls are verified.",
      "reviewedAt": "2027-01-28T13:00:00Z"
    }
  }
}
```

For a baseline-changing action, its completed outcome additionally requires `baselineChangeApproval` with reviewer, `approved` decision, rationale, and a timestamp no later than completion.

Requests require JSON and `Authorization: Bearer <API_TOKEN>`. The Worker fails closed without its secret and rejects cross-origin API requests, bodies over 2 MB, mismatched lineage, duplicate identities, incomplete outcomes, invalid chronology, and out-of-range policy values.

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

There are no runtime packages, databases, paid APIs, model calls, or background services.

## Repository map

```text
roadmap_recovery_verifier/
├── docs/                 # PRD, architecture and metrics
├── public/               # Responsive light/dark verification interface
├── src/                  # Deterministic verifier and Worker API
├── tests/                # Engine and HTTP boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [DOE EVMS Compliance Review SOP](https://www.energy.gov/projectmanagement/articles/evms-compliance-review-standard-operating-procedure-ecrsop) requires responsibility, effectiveness artifacts, validation, verification, and closure criteria; data findings commonly use consecutive performance periods.
- [DOE Project Management Lexicon](https://www.energy.gov/projectmanagement/project-management-lexicon-terms) defines corrective-action plans as documenting responsibility, commitment dates, verification steps, and completion evidence.
- [GAO corrective-action planning review](https://www.gao.gov/products/gao-10-65) emphasizes interim milestones, completion dates, validation steps, and verified completion evidence.
- [NIST corrective-action follow-up guidance](https://www.nist.gov/news-events/events/2014/04/proficiency-testing-follow-actions-and-root-cause-analysis) emphasizes follow-up activities to evaluate effectiveness.

These sources inform the controls. A passing result is not proof of causality, future delivery, DOE/GAO conformity, or certified EVMS compliance.

## License

[MIT](LICENSE)
