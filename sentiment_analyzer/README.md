<div align="center">

# Sentiment Analyzer

**Explainable sentiment for product feedback—without hiding uncertainty.**

English + Spanish · Confidence scores · Evidence traces · Aspect detection · Cloudflare-ready

![Tests](https://img.shields.io/badge/tests-15%20passing-72D572)
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
- Browser-local analysis requiring no API or payment
- Responsive light and dark themes

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

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler secret put API_TOKEN
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

These limitations are surfaced deliberately. The project should only move to LoRA fine-tuning, ONNX, or larger multilingual models after an evaluated labeled dataset proves the baseline insufficient.

## Tests

The 15-test suite covers English and Spanish sentiment, negation, intensifiers, emojis, aspects, uncertainty, invalid input, Feedback Collector events, Unicode tokenization, public health, API authentication, and authenticated batches.

```bash
npm run check
```

## Roadmap

- [x] Explainable bilingual baseline
- [x] Confidence and human-review flags
- [x] Feedback Collector contract
- [x] Secured batch API
- [x] Optional Workers AI review
- [x] Light and dark UI
- [ ] Labeled evaluation dataset and confusion matrix
- [ ] Per-domain lexicon configuration
- [ ] Aspect-level sentiment, not only aspect presence
- [ ] Human correction capture
- [ ] Calibration metrics and drift reports
- [ ] Carefully evaluated multilingual expansion

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
