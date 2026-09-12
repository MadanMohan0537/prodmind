<div align="center">

# Project 4: Feature Request Detector

**Separate product requests, bugs, complaints, questions, praise, and churn signals.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Project 4 adds explainable multi-label intent detection to the same normalized feedback records used by Projects 2 and 3. It identifies candidate product requests without treating classifier output as roadmap priority.

## Product impact

- **Decision improved:** whether a record expresses a request, defect, complaint, question, praise or churn risk.
- **Leading measures:** per-label precision and recall, review rate and correction patterns.
- **Portfolio value:** separates request-shaped evidence from general sentiment before opportunity formation.
- **Stop condition:** request frequency and classifier confidence never substitute for value, strategy or feasibility review.

## Place in ProdMind

Project 7 imports `detectIntents` directly, attaches the result to the source evidence ID, and passes the enriched record to the Voice-of-Customer dashboard. Project 6 later scores human-reviewed opportunities rather than raw classifier confidence.

## Implemented capabilities

- Explicit and implicit feature-request detection
- Bug, complaint, question, praise, churn-risk and other intent labels
- Multiple labels on one feedback record
- Evidence sentences for each detected intent
- Lexical urgency and broad-impact indicators
- Rule-derived confidence and human-review flag
- Feedback Collector identity preservation
- Authenticated bounded batch API
- Optional D1 analysis metrics
- Labeled-seed evaluation with per-label precision, recall and F1
- Responsive light/dark frontend

## Frontend

The application in `public/` accepts text or sample records, invokes the same detector used by the connected workflow, and displays labels, evidence, urgency, impact and review status.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report model name and persistence status |
| `POST` | `/api/analyze` | Analyze one record or a bounded batch |
| `GET` | `/api/metrics` | Return persisted intent counts when D1 exists |

## Run, evaluate and test

```bash
cd feature_request_detector
npm install
npm run check
npm run evaluate
npm run dev
```

## Deploy

Configure the D1 binding and allowed origins in `wrangler.jsonc`, apply the migration, set `API_TOKEN`, and run `npm run deploy`.

## Structure

```text
public/detector.js  Shared explainable intent engine
public/             Working frontend
src/worker.js       Secured API and optional persistence
evaluation/         Small labeled seed
scripts/            Evaluation runner
schema/             Request and result contracts
test/               Detector, evaluation and route tests
```

## Honest limits

- The rules are English-first and do not understand every paraphrase.
- Confidence is not a calibrated business probability.
- Urgency and impact are language signals that require human confirmation.
- Request frequency does not equal customer value or strategic importance.
- D1 counts analyzed records, not independently verified affected customers.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
