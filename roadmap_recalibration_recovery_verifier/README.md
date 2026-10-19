# Roadmap Recalibration Rollback & Recovery Verifier

Project 50 verifies that a human-authorized Project 49 rollback actually restored the exact prior estimate policy and remained stable before recovery is closed.

## Why this belongs in ProdMind

Project 48 validates a recalibration proposal. Project 49 assures its shadow and staged rollout. When Project 49 selects `rollback`, Project 50 closes the control loop with evidence rather than treating the decision itself as recovery.

```text
48 approved recalibration → 49 staged rollout → human rollback decision
        → 50 exact restoration + stable observation + human closeout
```

## What it verifies

- The Project 49 rollback decision matches the Project 48 recalibration.
- Execution follows authorization and retains the approved owner.
- Recovery completes inside the approved time limit.
- The exact prior version is restored in execution and every snapshot.
- Every reference class restores its exact pre-recalibration factors.
- Recovery remains observable for the minimum window and cadence.
- Each class has enough evidence and acceptable duration/capacity error.
- Incidents stay within the declared guardrail.
- Execution, factor, snapshot, and class evidence are complete.
- A named human chooses `close`, `continue_monitoring`, or `escalate`.

## Decision states

| State | Meaning |
|---|---|
| `verified_recovery` | Every gate passes and the reviewer chooses `close` |
| `blocked_close` | Close was requested while at least one gate failed |
| `action_required` | The reviewer chose continued monitoring or escalation |

## Architecture

| Layer | Responsibility |
|---|---|
| Deterministic engine | Reconcile lineage, authorization, timing, version, factors, snapshots, accuracy, incidents, and evidence |
| Worker API | Authenticate, enforce same-origin API use, cap bodies, and return no-store JSON |
| Static workbench | Provide an accessible light/dark recovery-review interface |
| Connected workflow | Reconstruct Projects 14 and 40–49 server-side before Project 50 verification |

No LLM performs the verification and no paid service is required.

## API

`POST /api/roadmap-recalibration-recovery`

```json
{
  "recalibrationReport": { "schemaVersion": "1.0.0", "status": "approved_recalibration" },
  "rolloutReport": { "schemaVersion": "1.0.0", "status": "action_required" },
  "input": {
    "id": "recovery-1",
    "asOf": "2027-03-13T12:00:00Z",
    "minimumObservationHours": 48,
    "maximumSnapshotGapHours": 48,
    "minimumSamplesPerClass": 30,
    "maximumDurationErrorRate": 0.15,
    "maximumCapacityErrorRate": 0.15,
    "maximumIncidents": 0,
    "execution": {},
    "factorRestorations": [],
    "snapshots": [],
    "review": {}
  }
}
```

Send `Authorization: Bearer <API_TOKEN>` and `Content-Type: application/json`. Tests demonstrate the complete field contract.

## Run and deploy

```bash
npm test
npx wrangler dev
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Research basis

- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final) distinguishes restoration from reconstitution validated through testing before normal operation resumes.
- [Google SRE: Canarying Releases](https://sre.google/workbook/canarying-releases/) supports small changes, control-versus-candidate monitoring, and rapid rollback when a candidate degrades service.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) contributes documented change control, recovery, testing, and assurance principles.
- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) supports retained actual evidence, validation, documentation, and controlled estimate updates.

## Boundaries

This verifier cannot establish evidence truth, causality, statistical significance, compliance, or future accuracy. It never changes a version, restores a factor, edits an estimate, modifies exposure or schedules, executes rollback, or closes recovery automatically.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed.
