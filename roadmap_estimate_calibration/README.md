# Roadmap Delivery Estimate Calibration & Reference-Class Engine

**ProdMind Project 44 turns completed Projects 40–41 delivery evidence into transparent reference-class calibration factors for future roadmap estimates.**

Project 40 schedules declared duration and capacity. Project 41 captures actual dates and capacity consumed. Project 44 closes the learning loop: it groups comparable completed work, measures historical error, and produces reviewable duration and capacity factors only when the class has enough fresh evidence.

## Product question

> What did comparable work actually require, and is the evidence sufficient to use as a cross-check when estimating future roadmap items?

The result is:

- `adopted_calibration` — every check passed and a named human chose `adopt`;
- `blocked_adoption` — adoption was requested with stale, insufficient, or incomplete evidence;
- `action_required` — a named human chose `revise` or `defer`.

No result rewrites a Project 40 estimate or claims to predict delivery.

## Architecture

```text
Completed Project 40 schedules
              +
Final Project 41 actuals
              ↓
Explicit reference-class mappings
              ↓
Validated duration + capacity ratios
              ↓
Median + nearest-rank percentile factors
              ↓
Human adopt | revise | defer
```

The connected Project 7 route reconstructs the current Projects 14, 40, and 41 case server-side, then combines it with structurally validated historical cases.

## Deterministic controls

1. Accept only approved Project 40 schedules with matching Project 41 reports.
2. Require completed actual dates and capacity for every item.
3. Require exactly one explained reference-class assignment per item.
4. Preserve customer and delivery evidence.
5. Reject duplicate case and item identities.
6. Measure elapsed-duration and capacity ratios without hiding negative error.
7. Use deterministic medians and nearest-rank percentiles.
8. Withhold recommended factors from undersized classes.
9. Block adoption when evidence exceeds the declared age policy.
10. Keep adoption, revision, and deferral as named human decisions.

Recommended factors have a floor of `1`: historical underruns do not silently compress future plans. Raw ratios remain visible so reviewers can make a different documented judgment.

## API

`POST /api/roadmap-estimate-calibration`

```json
{
  "runs": [],
  "cases": [{
    "scheduleReport": { "schemaVersion": "1.0.0", "id": "schedule-1", "status": "approved_schedule", "schedule": [] },
    "deliveryReport": { "schemaVersion": "1.0.0", "id": "delivery-1", "sourceScheduleId": "schedule-1", "items": [] },
    "classifications": [{
      "portfolioItemId": "run:item",
      "referenceClass": "onboarding-workflow",
      "basis": "Same product surface, team, and reviewed delivery shape."
    }]
  }],
  "input": {
    "id": "calibration-1",
    "asOf": "2027-02-01T00:00:00Z",
    "minimumReferenceClassSize": 3,
    "percentileRate": 0.8,
    "maximumEvidenceAgeDays": 365,
    "review": {
      "reviewer": "Portfolio council",
      "decision": "adopt",
      "rationale": "The classes are comparable, fresh, and sufficiently sampled.",
      "reviewedAt": "2027-02-01T01:00:00Z"
    }
  }
}
```

Requests require JSON and `Authorization: Bearer <API_TOKEN>`. The Worker rejects cross-origin API calls, bodies over 2 MB, invalid lineage, incomplete work, missing evidence, and out-of-range policy values.

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

There are no runtime packages, paid APIs, model calls, databases, or background services.

## Repository map

```text
roadmap_estimate_calibration/
├── docs/        PRD, architecture and metrics
├── public/      Responsive light/dark interface
├── src/         Deterministic engine and Worker
├── tests/       Engine and HTTP-boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [NASA CADRe](https://www.nasa.gov/ocfo/ppc-corner/cadre-once-data-collection-and-database/) preserves cost, schedule, technical, and actual data so analogous future estimates can improve.
- [NASA PP&C glossary](https://www.nasa.gov/ocfo/ppc-corner/ppc-glossary/) defines analogous estimating as using comparable historical activities, adjusted for complexity.
- [NASA SMART](https://www.nasa.gov/ocfo/ppc-corner/smart-schedule-management-and-relationship-tool/) compares proposed schedules with analogous historical missions and reports mean and confidence-level durations.
- [UK reference-class guidance](https://www.gov.uk/government/publications/optimism-bias-and-contingency-at-homes-england/optimism-bias-and-contingency-at-homes-england-accessible-version) uses historical outcomes from similar projects to address cost and schedule optimism bias.
- [FHWA schedule-estimating guidance](https://www.fhwa.dot.gov/majorprojects/schedule_estimating/) calls for a documented estimating process and qualified review.

These sources inform the control model. Product-delivery reference classes are smaller and more contextual than infrastructure or aerospace programs; Project 44 therefore exposes sample size, basis, error, and limitations instead of claiming transferable statistical certainty.

## License

[MIT](LICENSE)
