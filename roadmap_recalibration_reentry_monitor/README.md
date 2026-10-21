# Roadmap Recalibration Re-entry Assurance Monitor

Project 52 verifies the first observed retry after Project 51 authorizes a post-incident roadmap-estimation recalibration. It makes sure the actual trial still matches the approved candidate, scope, owner, exposure, controls, rollback, and monitoring plan before a human allows it to continue.

## Why it belongs in ProdMind

Project 51 can approve a carefully bounded re-entry plan, but approval is not evidence that execution stayed within that plan. Project 52 closes the gap between intended and observed re-entry.

```text
48 validated candidate → 49 rollout failure → 50 verified recovery
    → 51 learning and re-entry approval → 52 observed re-entry assurance
```

This mirrors a core ProdMind principle: a prospective control and its observed effectiveness are separate decisions.

## Deterministic controls

- Exact Project 51, Project 50, Project 49, and Project 48 lineage
- Explicit Project 51 `ready_for_reentry` and human `approve_reentry`
- Declaration after approval and before exposure
- Exact owner, recovered baseline, new candidate version, and reference-class scope
- One zero-exposure shadow stage followed by increasing active stages
- Exposure capped by both Project 51 and the local assurance policy
- Minimum stage dwell and maximum inter-stage gap
- Exact per-class observation coverage and minimum sample size
- Paired baseline-versus-candidate duration and capacity error
- Candidate accuracy and minimum-improvement thresholds
- Every required corrective action operational in every stage
- Every Project 51 contributing condition monitored for recurrence
- Incident guardrail and evidenced rollback drill
- Reviewer independence from Project 51 reviewers and approvers
- Named human `continue`, `pause`, or `rollback` decision

`continue` produces `verified_reentry` only when every check passes. Failed continuation produces `blocked_continue`; `pause` and `rollback` remain `action_required` because this monitor never performs either action.

## Architecture

| Layer | Responsibility |
|---|---|
| Deterministic engine | Validate lineage, declaration, stages, paired outcomes, controls, recurrence, rollback, and review |
| Worker API | Authenticate, reject cross-origin API calls, cap bodies, and return no-store JSON |
| Static workbench | Provide an accessible system-aware light/dark assurance interface |
| Connected workflow | Reconstruct Projects 14 and 40–51 server-side before Project 52 assessment |

No LLM performs the decision. There are no runtime dependencies, paid APIs, hosted databases, or hidden network calls.

## API

`POST /api/roadmap-recalibration-reentry-assurance`

```json
{
  "learningReport": {
    "schemaVersion": "1.0.0",
    "status": "ready_for_reentry",
    "review": { "decision": "approve_reentry" }
  },
  "input": {
    "id": "assurance-1",
    "asOf": "2027-03-30T13:00:00Z",
    "minimumStageDwellHours": 24,
    "maximumStageGapHours": 2,
    "minimumSamplesPerClass": 30,
    "maximumExposureRate": 0.05,
    "maximumCandidateErrorRate": 0.15,
    "minimumImprovementRate": 0.05,
    "maximumIncidents": 0,
    "declaration": {},
    "stages": [],
    "rollback": {},
    "review": {}
  }
}
```

Send `Authorization: Bearer <API_TOKEN>` and `Content-Type: application/json`. The engine test fixture documents the complete request contract.

## Run locally

```bash
npm test
npm run check
npx wrangler dev
```

Set the deployment secret and deploy:

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Cloudflare Workers free-plan limits still apply.

## Research basis

- [Google SRE Canary Release](https://sre.google/workbook/canarying-releases/) recommends partial, time-limited exposure and comparison with a control before broader rollout.
- [Google SRE Production Services Best Practices](https://sre.google/sre-book/service-best-practices/) recommends supervised rollouts and prompt rollback when unexpected behavior appears.
- [NIST AI RMF Playbook — Manage](https://airc.nist.gov/airmf-resources/playbook/manage/) calls for post-deployment monitoring, incident response, recovery, override, and change-management plans.
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) integrates incident detection, response, and recovery with continuing risk management.
- [NIST SP 800-137](https://csrc.nist.gov/pubs/sp/800/137/final) emphasizes ongoing visibility into the effectiveness of deployed controls.

## Boundaries

Project 52 does not change exposure, activate or promote a policy version, edit estimates, pause or roll back a trial, assign blame, establish statistical significance, or prove causality. It evaluates supplied evidence against predeclared controls and preserves the named human decision.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed.
