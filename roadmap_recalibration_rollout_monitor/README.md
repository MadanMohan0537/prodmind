# Roadmap Recalibration Rollout Assurance Monitor

Project 49 closes the gap between an approved estimate recalibration and a safe human promotion decision. It verifies a zero-exposure shadow, increasing active stages, concurrent baseline comparison, exact factors, sufficient dwell and evidence, and an executable rollback—without changing production state.

## Why this belongs in ProdMind

Projects 44–48 learn from completed roadmap delivery, govern adoption, measure effectiveness, detect drift, and validate a bounded replacement. Project 49 proves whether that replacement survived controlled real-world introduction before a human promotes it.

```text
Project 44 calibration → 45 adoption → 46 effectiveness → 47 drift
        → 48 approved recalibration → 49 shadow + staged rollout assurance
```

## What it verifies

- Project 48 is approved and unexpired when rollout begins.
- The declaration names the exact active and proposed versions.
- The first stage is shadow-only; later exposure increases strictly.
- Every stage evaluates the exact Project 48 version and factors.
- Every reference class has a minimum paired sample and dwell period.
- Candidate duration and capacity errors remain below policy and improve on the concurrent baseline.
- Incident counts remain within the declared guardrail.
- The last-known-good version was tested within the approved recovery limit.
- A named human chooses `promote`, `pause`, or `rollback`.

## Decision states

| State | Meaning |
|---|---|
| `verified_rollout` | Every gate passes and the reviewer chooses `promote` |
| `blocked_promotion` | Promotion was requested while at least one gate failed |
| `action_required` | A reviewer explicitly chose `pause` or `rollback` |

Passing checks never promote anything automatically.

## Architecture

| Layer | Responsibility |
|---|---|
| Deterministic engine | Validate lineage, sequence, versions, factors, paired metrics, incidents, and rollback |
| Worker API | Authenticate, enforce same-origin requests, cap bodies, and return no-store JSON |
| Static workbench | Provide an accessible light/dark interface for reviewed JSON requests |
| Connected workflow | Reconstruct Projects 14 and 40–48 server-side before running Project 49 |

The engine is deliberately dependency-free. It uses sample-weighted comparisons, not an LLM, to make every gate reproducible and inspectable.

## API

`POST /api/roadmap-recalibration-rollout`

```json
{
  "recalibrationReport": { "schemaVersion": "1.0.0", "status": "approved_recalibration" },
  "input": {
    "id": "rollout-1",
    "asOf": "2027-03-10T00:00:00Z",
    "minimumStageDwellHours": 24,
    "minimumSamplesPerClass": 30,
    "maximumExposureRate": 0.5,
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

Send `Authorization: Bearer <API_TOKEN>` and `Content-Type: application/json`. The complete field contract is enforced in `src/monitor.js` and demonstrated in the tests.

## Run locally

```bash
npm test
npx wrangler dev
```

Set the secret before deployment:

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

The project uses only Cloudflare Workers static assets and standard JavaScript. It needs no paid API, model, database, or telemetry service.

## Research basis

- [Google SRE: Canarying Releases](https://sre.google/workbook/canarying-releases/) motivates small, time-bounded candidate exposure, control comparison, increasing stages, representative duration, and rollback.
- [NIST SP 800-53 Rev. 5, CM-3](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final) motivates approved, documented, tested, validated, and reviewed configuration changes.
- [NIST AI RMF Core, Manage 4](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) contributes the general post-deployment monitoring, recovery, override, and change-management pattern; this project is deterministic and does not claim AI-RMF compliance.
- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) supports maintaining estimates with actual evidence, validation, documentation, and explicit updates.

## Boundaries

This tool does not establish statistical significance, causality, compliance, or future accuracy. It cannot verify that submitted evidence is truthful. It never changes exposure, activates factors, edits estimates, promotes a version, or executes rollback. Those remain external, authorized human actions.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed.
