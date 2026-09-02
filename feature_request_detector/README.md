<div align="center">

# ProdMind Feature Request Detector

**Separate product requests from bugs—and keep every overlapping intent.**

Explainable · Multi-label · Local-first · Zero paid APIs · Cloudflare-ready

</div>

Feature Request Detector is project 04 in [ProdMind](../README.md). It converts customer feedback into an inspectable set of intents instead of forcing every message into one category. A single record can be a feature request, bug report, complaint, question, praise, and churn warning at the same time.

## Why it exists

Feedback rarely arrives in tidy categories. “I love the dashboard, but it crashes and we need scheduled exports before renewal” contains praise, a bug, a feature request, urgency, business impact, and churn risk. A single-label classifier discards most of that evidence.

This product provides a deterministic baseline that is inexpensive, private, testable, and honest about uncertainty. It is suitable for triage and dataset bootstrapping; it does not pretend that a rule system replaces evaluated domain-specific machine learning.

## Capabilities

- Multi-label detection for feature requests, bugs, complaints, praise, questions, and churn risk
- Explicit request detection such as “please add”
- Implicit unmet-need detection such as “I wish there was”
- Sentence-level evidence and matched signals
- Confidence per detected intent and a primary intent
- Urgency and impact indicators
- Human-review flag for ambiguous feedback
- Feedback Collector event compatibility
- Browser-local analysis with no server submission
- Secured single-record and batch API
- Optional D1 analysis history and aggregate metrics
- Strict CORS allowlist and output escaping
- Versioned JSON schemas
- Labeled evaluation seed data and per-label precision, recall, and F1
- Responsive system-aware light and dark interface

## Architecture

```mermaid
flowchart TD
  A[Feedback text or event] --> B[Normalize and split sentences]
  B --> C[Independent intent rules]
  C --> D[Multi-label confidence]
  D --> E[Evidence and review flag]
  D --> F[Urgency and impact]
  E --> G[(Optional D1 history)]
```

The browser and Worker import the same `public/detector.js` module, preventing classification drift between the demo and the deployed API.

## Quick start

Requires Node.js 20 or newer.

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/feature_request_detector
npm install
npm test
npm run dev
```

Open the local URL printed by Wrangler. The interface analyzes text entirely in the browser, so the demo needs neither a token nor a database.

## API

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service, model, and persistence status |
| `POST` | `/api/analyze` | Bearer token | Analyze one item or up to 500 items |
| `GET` | `/api/metrics` | Bearer token | Aggregate persisted results |

```bash
curl -X POST http://localhost:8787/api/analyze \
  -H 'Authorization: Bearer local-development-token' \
  -H 'Content-Type: application/json' \
  --data @examples/sample-feedback.json
```

Representative result:

```json
{
  "schemaVersion": "1.0.0",
  "model": "prodmind-explainable-multilabel-v1",
  "primaryIntent": "feature-request",
  "isFeatureRequest": true,
  "requestType": "explicit",
  "confidence": 0.8199,
  "intents": [
    {
      "label": "feature-request",
      "confidence": 0.8199,
      "evidence": [{ "sentenceIndex": 0, "sentence": "Please add CSV export." }]
    }
  ],
  "urgency": { "level": "low", "score": 0 },
  "impact": { "level": "low", "score": 0 },
  "needsReview": false
}
```

Input and result contracts are documented under [`schema/`](schema/). Individual invalid records produce indexed errors without failing the rest of a batch.

## Cloudflare deployment

1. Create the free D1 database:

   ```bash
   npx wrangler d1 create feature-request-detector-db
   ```

2. Replace the placeholder database ID in `wrangler.jsonc`.
3. Set `ALLOWED_ORIGINS` to the exact browser origins allowed to call the API.
4. Apply the migration and create the secret:

   ```bash
   npm run db:migrate:remote
   npx wrangler secret put API_TOKEN
   ```

5. Deploy:

   ```bash
   npm run deploy
   ```

For local API testing, create an untracked `.dev.vars` file containing `API_TOKEN="local-development-token"`. D1 is optional: remove its binding for stateless API operation.

## Security and privacy

- Browser analysis keeps feedback on the device.
- API access fails closed when `API_TOKEN` is missing.
- Cross-origin API requests are accepted only from configured origins.
- Bearer tokens are compared through fixed-length SHA-256 digests.
- Inputs are length- and batch-bounded.
- Browser-rendered evidence is HTML-escaped.
- D1 uses parameterized statements and stores text hashes, not raw feedback.
- Internal exceptions are not exposed in API responses.

For a public multi-tenant deployment, add per-user identity, tenant isolation, abuse controls, and a distributed rate limiter.

## Evaluation

The included seed dataset validates the evaluation machinery; it is not evidence of production accuracy.

```bash
npm run check
node scripts/evaluate.js evaluation/labeled-feedback.json
```

The report includes exact multi-label match, per-label precision/recall/F1, and mismatched examples. Replace or extend the seed data with anonymized feedback from the intended domain before tuning thresholds or making quality claims.

## Honest limitations

- Rules recognize known language patterns but do not understand arbitrary paraphrases or sarcasm.
- The baseline rules are English-first.
- Confidence represents accumulated rule evidence, not a calibrated probability.
- Urgency and impact are lexical signals and require human confirmation for prioritization.
- This detects requests; it does not decide whether a request should be built.
- D1 metrics describe analyzed volume, not customer demand deduplicated across accounts.

## Integration with ProdMind

- **Feedback Collector** supplies normalized events.
- **Sentiment Analyzer** adds sentiment and aspects independently.
- **Topic Modeler** groups related requests into broader opportunities.
- Future prioritization modules can combine request evidence, customer segments, frequency, effort, and strategy—but should not use this detector’s confidence as business value.

## Roadmap

- Domain-specific configurable phrase packs
- English/Spanish parity with evaluated labeled data
- Human corrections and threshold calibration
- Semantic embedding candidate generation in an optional offline research package
- Cross-record request deduplication through Topic Modeler
- Export queue for downstream prioritization workflows

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
