# Product Assumption Risk Register

Project 18 makes the assumptions behind ProdMind investments explicit, traceable, and testable. It links each assumption to one selected opportunity, validates evidence and experiment references against authoritative run data, and orders unresolved assumptions using a transparent exposure heuristic.

It answers: **“What must be true for this product bet to work, and which uncertainty should we test next?”**

## Why it belongs in ProdMind

Evidence and outcomes do not eliminate hidden assumptions. A team can have strong customer evidence while still relying on an untested usability, feasibility, viability, desirability, or compliance belief. This register preserves those beliefs as reviewable records instead of allowing them to disappear inside roadmap rationale.

```text
Selected opportunity + authoritative evidence + experiments
                            ↓
             explicit categorized assumptions
                            ↓
       importance × declared uncertainty × status
                            ↓
       validation queue + owner + review deadline
```

## Implemented

- Five categories: desirability, viability, feasibility, usability, and compliance.
- Status lifecycle: untested, testing, supported, and refuted.
- Declared importance, uncertainty, owner, review date, and validation method.
- Authoritative evidence and experiment link validation.
- Overdue and unlinked-assumption reporting.
- Deterministic validation queue with full opportunity and decision lineage.
- Authenticated Cloudflare Worker and responsive light/dark interface.
- No paid API, model, database, or software dependency.

## API

`POST /api/assumptions`

```json
{
  "runs": [],
  "options": {
    "asOf": "2026-09-16",
    "assumptions": [{
      "id": "a-1",
      "portfolioItemId": "run-1:opp-1",
      "statement": "First-time users understand the onboarding checklist.",
      "category": "usability",
      "status": "untested",
      "importance": 5,
      "uncertainty": 0.8,
      "owner": "Growth PM",
      "reviewBy": "2026-10-01",
      "validationMethod": "Moderated task study with first-time users.",
      "linkedEvidenceIds": ["feedback-1"],
      "linkedExperimentIds": []
    }]
  }
}
```

Project 7 exposes `POST /api/assumption-risk` and supplies recent D1-backed runs, so the connected body contains `assumptions` and optional `asOf` directly.

## Score boundary

`importance × declared uncertainty × status weight`, plus a visible overdue increment, is a prioritization heuristic. It is not a probability, confidence estimate, forecast, or automatic product decision. Supported and refuted assumptions remain in the ledger for auditability.

## Run

```bash
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## License

MIT
