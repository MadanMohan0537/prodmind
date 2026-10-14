# Roadmap Estimate Basis & Calibration Adoption Controller

**ProdMind Project 45 proves whether approved roadmap estimates actually use Project 44 calibration—or carry a prior, independently reviewed exception.**

Project 44 learns from completed Projects 40–41 work. Project 45 closes the operational loop before a new schedule is accepted: for every Project 40 item, it records the unadjusted base, identifies a sufficiently sampled reference class, verifies the applied duration and capacity factors, recalculates the approved values, and controls any deliberate departure.

## Product question

> Did every approved roadmap estimate apply the adopted historical calibration, and if not, was the exception explicit, evidenced, independent, and approved before the schedule?

The result is:

- `approved_estimate_basis` — every control passed and a named human chose `approve`;
- `blocked_approval` — approval was requested despite stale calibration, missing coverage, unreconciled arithmetic, an unusable class, or an uncontrolled departure;
- `action_required` — a named human chose `revise` or `defer`.

No result generates an estimate or changes a schedule.

## Architecture

```text
Project 44 adopted calibration
              +
Project 40 approved schedule
              ↓
Per-item base + applied factors
              ↓
Class, freshness + arithmetic checks
              ↓
Prior independent exception control
              ↓
Human approve | revise | defer
```

The connected Project 7 route reconstructs the Projects 14 and 40 reports and builds the Project 44 calibration from bounded completed cases before running Project 45.

## Deterministic controls

1. Accept only an approved Project 40 schedule.
2. Accept only a Project 44 calibration adopted before that schedule.
3. Enforce a maximum calibration age.
4. Require exactly one application for every scheduled item.
5. Require a sufficiently sampled class with both recommended factors.
6. Recalculate `ceil(base duration × applied factor)`.
7. Recalculate `base capacity-days × applied factor`.
8. Compare recalculated values with the approved schedule under bounded tolerances.
9. Require a prior, evidenced, independent exception for any lower factor.
10. Reject unnecessary exceptions and preserve customer evidence.
11. Keep approval, revision, and deferral as named human decisions.

## API

`POST /api/roadmap-estimate-adoption`

```json
{
  "runs": [],
  "scheduleReport": {
    "schemaVersion": "1.0.0",
    "id": "schedule-45",
    "asOf": "2027-02-01T00:00:00Z",
    "status": "approved_schedule",
    "schedule": []
  },
  "calibrationReport": {
    "schemaVersion": "1.0.0",
    "id": "calibration-44",
    "asOf": "2027-01-20T00:00:00Z",
    "status": "adopted_calibration",
    "referenceClasses": []
  },
  "input": {
    "id": "estimate-control-45",
    "asOf": "2027-02-01T12:00:00Z",
    "maximumCalibrationAgeDays": 90,
    "roundingToleranceDays": 1,
    "capacityToleranceRate": 0.05,
    "applications": [{
      "portfolioItemId": "run:item",
      "referenceClass": "onboarding-work",
      "baseDurationDays": 8,
      "baseCapacityDays": 16,
      "appliedDurationFactor": 1.5,
      "appliedCapacityFactor": 1.25,
      "estimateBasis": "Base estimate and factor application are recorded in worksheet estimate-27.",
      "evidence": "Worksheet estimate-27 and architecture evidence arch-12."
    }],
    "review": {
      "reviewer": "Investment committee",
      "decision": "approve",
      "rationale": "Every estimate reconciles to an adopted factor or controlled exception.",
      "reviewedAt": "2027-02-01T13:00:00Z"
    }
  }
}
```

An application whose factor is below the recommendation also needs an `exception` with `reviewer`, `decision: "approve"`, `rationale`, `evidence`, and `reviewedAt`. The exception must predate schedule approval, and its reviewer must differ from both the Project 40 and Project 44 reviewers.

Requests require JSON and `Authorization: Bearer <API_TOKEN>`. The Worker rejects cross-origin API calls, bodies over 2 MB, invalid chronology, incomplete coverage, duplicate identities, and out-of-range policy values.

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
roadmap_estimate_adoption_controller/
├── docs/        PRD, architecture and metrics
├── public/      Responsive light/dark interface
├── src/         Deterministic controller and Worker
├── tests/       Engine and HTTP-boundary tests
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Research basis

- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) emphasizes ground rules, assumptions, data, methods, documentation, review, and updating estimates with actuals.
- [NASA Cost Estimating Handbook, Appendix H](https://www.nasa.gov/wp-content/uploads/2020/11/ceh_apph.pdf) calls for documenting calibration data, analogy adjustments, models, settings, and input sources.
- [NASA software estimating guidance](https://swehb.nasa.gov/plugins/viewsource/viewpagesrc.action?pageId=16449831) recommends retaining basis-of-estimate history and estimate-versus-actual performance for future analogies.
- [UK Cost Estimating Guidance](https://www.gov.uk/government/publications/cost-estimating-guidance/cost-estimating-guidance) provides a best-practice estimating and assurance framework.
- [UK reference-class guidance](https://www.gov.uk/government/publications/optimism-bias-and-contingency-at-homes-england/optimism-bias-and-contingency-at-homes-england-accessible-version) uses actual performance from comparable projects as an outside view on optimism bias.

These sources inform the control design; they do not certify this implementation or make software delivery estimates statistically equivalent to aerospace or infrastructure estimates.

## Limitations

- Project 45 validates declared lineage and arithmetic, not the intrinsic quality of the base estimate.
- A sufficiently sampled Project 44 class is a contextual historical cross-check, not a probability or causal model.
- Independent review is checked by reviewer identity strings; production identity and separation-of-duties enforcement belongs in the authentication layer.
- Submitted standalone reports are structurally validated, not cryptographically attested.

## License

[MIT](LICENSE)
