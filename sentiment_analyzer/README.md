<div align="center">

# Sentiment Analyzer

**Explainable sentiment for product feedback—without hiding uncertainty.**

English + Spanish · Confidence scores · Evidence traces · Aspect detection · Cloudflare-ready

![Tests](https://img.shields.io/badge/tests-21%20JavaScript%20%2B%204%20Python-72D572)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

</div>

Sentiment Analyzer is project 02 of ProdMind. It consumes text or normalized Feedback Collector events and returns a versioned sentiment result with a label, score, confidence, language, evidence, detected aspects, and a human-review recommendation.

## Why it exists

Positive/negative labels alone are dangerous product evidence. Teams need to know why a result was assigned and when the classifier is uncertain. This project therefore begins with a deterministic, testable baseline and optionally asks Cloudflare Workers AI to review low-confidence cases within its free allocation.

## Capabilities

- English and Spanish lexicons
- Positive, neutral, and negative labels
- Normalized scores from `-1` to `1`
- Explicit confidence scores
- Negation handling such as “not slow”
- Intensity handling such as “very good”
- Emoji sentiment signals
- Evidence showing matched terms and their weights
- Product-aspect detection for performance, usability, reliability, and support
- Human-review flags for uncertain outputs
- Feedback Collector event compatibility
- Secured single and batch HTTP analysis
- Optional Workers AI review for low-confidence cases
- D1 persistence for analysis history
- Human correction capture
- Aggregate label, language, confidence, and review metrics
- Labeled evaluation data with accuracy, confusion matrix, precision, recall, F1, and Brier score
- Browser-local analysis requiring no API or payment
- Responsive light and dark themes
- Strict origin checks and output escaping for browser safety

## Quick start

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/sentiment_analyzer
npm install
npm test
npm run dev
```

## API

```http
POST /api/analyze
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

Feedback Collector batch:

```json
{
  "records": [
    { "id": "feedback-1", "text": "The dashboard is fast and easy" },
    { "id": "feedback-2", "text": "La aplicación es muy lenta" }
  ]
}
```

Example result:

```json
{
  "eventId": "feedback-1",
  "schemaVersion": "1.0",
  "label": "positive",
  "score": 0.6667,
  "confidence": 0.81,
  "language": "en",
  "model": "explainable-lexicon-v1",
  "evidence": [
    { "token": "fast", "weight": 2, "negated": false },
    { "token": "easy", "weight": 2, "negated": false }
  ],
  "aspects": ["performance", "usability"],
  "needsReview": false
}
```

The endpoint accepts at most 500 inputs per request. `/api/health` is public; analysis requires a bearer token.

### Record a human correction

```http
POST /api/corrections
Authorization: Bearer YOUR_API_TOKEN

{"analysisId":"returned-analysis-id","correctedLabel":"neutral","note":"Sarcastic wording"}
```

### Inspect operational metrics

```http
GET /api/metrics
Authorization: Bearer YOUR_API_TOKEN
```

Returns label and language volumes, average confidence, review volume, and correction count.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create sentiment-analyzer-db
# Copy the returned database ID into wrangler.jsonc
npx wrangler secret put API_TOKEN
npm run db:migrate:remote
npm run deploy
```

Update `ALLOWED_ORIGINS` in `wrangler.jsonc` before deployment. The Workers AI binding is already declared; its review step runs only for low-confidence results and gracefully returns the deterministic result if AI is unavailable.

## Architecture

```text
Feedback text/event
  -> language detection
  -> tokenization
  -> weighted lexicon
  -> negation/intensity adjustment
  -> score + confidence
  -> aspect extraction
  -> optional AI review
  -> versioned result
```

The browser imports the same `public/analyzer.js` module as the Worker, preventing UI/API classification drift.

## Honest limitations

- Language support is currently limited to English and Spanish.
- Language detection is heuristic rather than a trained identifier.
- The baseline does not understand sarcasm, long-distance context, or domain jargon automatically.
- Aspect detection uses transparent keyword groups.
- Workers AI review consumes Cloudflare’s free daily allowance and can be unavailable.
- Confidence measures rule evidence, not statistically calibrated probability.

These limitations are surfaced deliberately. The optional `ml/` package provides the advanced training and export path, but promotion still requires a representative labeled dataset and measured improvement over the baseline.

## Tests

The project has 21 JavaScript tests and 4 dependency-free Python data-contract tests. They cover the baseline analyzer, API behavior, origin enforcement, correction validation, evaluation metrics, and ML dataset validation.

```bash
npm run check
python -m unittest discover -s ml/tests
```

## Evaluation and calibration

The repository includes a small transparent seed dataset under `evaluation/`. It proves the evaluation pipeline, not production accuracy.

```bash
npm run evaluate
```

The report contains accuracy, a confusion matrix, per-label precision/recall/F1, a Brier-style confidence score, and misclassified examples. Extend it with anonymized domain-specific feedback before making accuracy claims.

## Original specification coverage

| Advanced requirement | Current status | Boundary |
|---|---|---|
| Domain-specific sentiment | Baseline implemented | Real domain claims require domain-specific labeled data. |
| Uncertainty quantification | Two implementations | Baseline confidence/Brier metrics plus ML Monte Carlo dropout. |
| Multilingual support | Baseline + XLM-R path | Baseline supports English/Spanish; XLM-R training can expand only with evaluated labels. |
| GPU-accelerated serving | Export path implemented | ONNX/TensorRT artifacts require a separate compatible runtime, not Cloudflare Workers. |
| Explainability | Two implementations | Baseline token evidence plus ML integrated gradients. |
| LoRA/adapters | Training pipeline implemented | Runs on a compatible local or free notebook GPU; no production adapter is claimed from the sample data. |
| Monte Carlo dropout | Implemented in `ml/` | Reports probability variance and predictive entropy from repeated dropout passes. |
| XLM-R | Implemented in `ml/` | Configured as the multilingual base model for LoRA fine-tuning. |
| ONNX/TensorRT | Export paths implemented | ONNX export is runnable; TensorRT conversion requires NVIDIA tooling and cannot run on Cloudflare. |
| Integrated gradients | Implemented in `ml/` | Captum token attributions are available for trained adapters. |

The research code is runnable, but the repository does not claim a trained production model. The bundled miniature dataset validates plumbing only.

## Roadmap

- [x] Explainable bilingual baseline
- [x] Confidence and human-review flags
- [x] Feedback Collector contract
- [x] Secured batch API
- [x] Optional Workers AI review
- [x] Light and dark UI
- [x] D1 analysis history and human corrections
- [x] Operational metrics
- [x] Reproducible evaluation report
- [x] XLM-R LoRA training pipeline
- [x] Monte Carlo dropout uncertainty
- [x] Integrated-gradients explanations
- [x] ONNX export and optional TensorRT conversion
- [x] Seed labeled evaluation dataset and confusion matrix tooling
- [ ] Per-domain lexicon configuration
- [ ] Aspect-level sentiment, not only aspect presence
- [x] Human correction capture
- [x] Initial calibration metrics
- [ ] Drift reports
- [ ] Carefully evaluated multilingual expansion

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
