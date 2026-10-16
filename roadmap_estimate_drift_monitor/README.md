# Roadmap Estimate Calibration Drift & Recalibration Readiness Monitor

**ProdMind Project 47** detects whether roadmap-estimate calibration is losing accuracy across successive completed-delivery reviews.

Project 44 creates reference-class factors, Project 45 governs their adoption, and Project 46 checks one estimate basis against actual outcomes. Project 47 adds the missing longitudinal control: it compares non-overlapping baseline and recent Project 46 windows, class by class, and identifies where investigation or recalibration is justified.

It uses deterministic JavaScript, deploys to Cloudflare Workers, and requires no paid model, database, or API.

## Decision it supports

Should the organization retain the current calibration basis, investigate an emerging signal, or start a separately governed recalibration process?

The monitor evaluates:

- Recent duration and capacity accuracy
- Change from baseline accuracy
- Retention of base-to-calibrated error improvement
- Minimum samples in both windows
- Reference-class coverage
- Assessment cadence and evidence age
- Source and customer-evidence lineage

It returns `stable_calibration`, `blocked_retention`, or `action_required`. It never creates a new factor, changes an estimate or schedule, ranks people, or claims causality.

## Connected architecture

```text
Projects 40–45 governed estimate chain
                 ↓
Project 46 completed-outcome assessments
                 ↓
Baseline window     Recent window
          \         /
       Per-class deterministic comparison
                 ↓
Project 47 stability checks and candidates
                 ↓
Human retain | investigate | recalibrate
```

The connected Project 7 endpoint reconstructs the latest Projects 14, 40, 41, 44, 45, and 46 chain server-side. Historical Project 46 reports remain explicitly supplied, structurally validated evidence.

## API

`POST /api/roadmap-estimate-drift`

```json
{
  "runs": [],
  "project46Reports": [
    { "schemaVersion": "1.0.0", "id": "assessment-1", "asOf": "2027-01-01T00:00:00Z", "status": "verified_effectiveness", "items": [] },
    { "schemaVersion": "1.0.0", "id": "assessment-2", "asOf": "2027-01-08T00:00:00Z", "status": "verified_effectiveness", "items": [] },
    { "schemaVersion": "1.0.0", "id": "assessment-3", "asOf": "2027-01-15T00:00:00Z", "status": "verified_effectiveness", "items": [] }
  ],
  "input": {
    "id": "drift-2027-q1",
    "asOf": "2027-01-16T00:00:00Z",
    "baselineReportCount": 1,
    "recentReportCount": 2,
    "minimumItemsPerClass": 2,
    "maximumAssessmentGapDays": 14,
    "maximumReportAgeDays": 7,
    "maximumDurationErrorRate": 0.2,
    "maximumCapacityErrorRate": 0.2,
    "maximumErrorIncreaseRate": 0.05,
    "minimumErrorReductionRate": 0.05,
    "minimumClassCoverageRate": 0.8,
    "review": {
      "reviewer": "Estimation council",
      "decision": "retain",
      "rationale": "Accuracy and improvement remain stable.",
      "reviewedAt": "2027-01-16T01:00:00Z"
    }
  }
}
```

Use `Authorization: Bearer <API_TOKEN>`. Each Project 46 report must include its complete source IDs, bounded item metrics, and evidence lineage; abbreviated objects above show only the envelope.

## Local development

```bash
npm install
npm test
npx wrangler dev
```

Create an uncommitted `.dev.vars` file:

```text
API_TOKEN=replace-with-a-long-random-secret
```

## Deploy

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Cloudflare account limits still apply. No paid dependency is introduced by this repository.

## Research basis

- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) recommends updating estimates with actual data and analyzing estimated-versus-actual differences.
- [NIST Process or Product Monitoring and Control](https://www.itl.nist.gov/div898/handbook/pmc/pmc.htm) describes monitoring techniques that signal when investigation or corrective action is appropriate.
- [NIST variables control-chart guidance](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc32.htm) warns against frequently moving a historical comparison basis without a compelling reason.
- [U.S. Department of Energy variance and trend analysis](https://www.energy.gov/media/286157) describes using performance trends alongside variance analysis.

Project 47 borrows the feedback-loop principle, not a claim of certified cost estimating, EVM, or statistical process control.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

## License

MIT
