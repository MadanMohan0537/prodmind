# Product Investment Assurance Review

Project 17 is ProdMind’s post-implementation decision gate. It combines selected-work lineage with Project 16 benefit measurements, checks whether an investment review is evidence-complete, records a named human decision, and tracks corrective actions.

It answers: **“Can we close, continue, correct, or escalate this product investment—and is the review record complete?”**

## Why Project 17

Shipping is not closure. Mature governance retains a post-implementation review, confirms whether the investment case remains justified, captures lessons, assigns owners, and follows unresolved actions. ProdMind already measures outcomes and benefits; this project turns those inputs into an auditable review without automating the judgment.

```text
Selected opportunity + experiments + decisions + evidence
                          ↓
               Project 16 benefit report
                          ↓
        deterministic completeness checks
                          ↓
     named reviewer decision + corrective actions
```

## Implemented

- Decisions: `continue`, `correct`, `close`, or `escalate`.
- Checks for evidence, reviewed decision, benefit profile, measurement, overdue data, and attribution review.
- Corrective-action owner, due date, status, and overdue detection.
- Canonical `portfolioItemId` resolution against selected work.
- Evidence, experiment, decision, outcome-review, and benefit lineage.
- Authenticated, bounded Cloudflare Worker API.
- Responsive system-aware light/dark interface.
- No paid model, service, or database dependency.

## Input

`POST /api/assurance`

```json
{
  "runs": [],
  "benefitReport": {"schemaVersion":"1.0.0","benefits":[]},
  "options": {
    "reviews": [{
      "id":"pir-1",
      "portfolioItemId":"run-1:opp-1",
      "reviewer":"Product council",
      "reviewedAt":"2026-09-15",
      "decision":"correct",
      "rationale":"Benefit evidence is incomplete; remeasure after the next full cycle.",
      "actions":[{"id":"a-1","description":"Repeat measurement","owner":"Growth PM","dueAt":"2026-10-15","status":"open"}]
    }]
  }
}
```

In Project 7, call `POST /api/investment-assurance` with `benefits` plus `reviews`. The server builds the Project 16 report from recent D1-backed runs before running the assurance review.

## Verify and deploy

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## Trust boundaries

- The code checks completeness; a human supplies the decision and rationale.
- A complete review is not proof that an investment caused an outcome.
- Below-target benefits do not force a decision.
- Corrective and escalation decisions require at least one action.
- The module never edits rankings, experiments, benefits, or portfolio state.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
