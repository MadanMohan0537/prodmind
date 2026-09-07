<div align="center">

# Project 2: Sentiment Analyzer

**Add explainable sentiment signals without hiding the evidence.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Project 2 enriches normalized Project 1 feedback with deterministic sentiment, language, aspect, confidence, token evidence, and a human-review flag. It is deliberately a transparent baseline rather than a claimed production ML model.

## Place in ProdMind

The connected workspace attaches each sentiment result to the same feedback ID before topic detection, intent detection, Voice-of-Customer aggregation, prioritization, experimentation, outcome monitoring, and learning retrieval.

## Implemented capabilities

- English and Spanish rule packs
- Positive, negative, mixed and neutral labels
- Negation, intensifier and emoji handling
- Aspect-presence detection
- Evidence tokens and rule-derived confidence
- Human-review flags for weak or conflicting evidence
- Bounded authenticated batch analysis
- Optional D1 analysis history, corrections and operational metrics
- Optional Workers AI review only when an `AI` binding is configured
- Reproducible evaluation against the bundled labeled seed
- Responsive system-aware light/dark frontend

No XLM-R, LoRA, ONNX, TensorRT, Python training pipeline, or GPU model is included in this repository.

## Frontend

The files in `public/` provide a working analyzer. Users can enter or load feedback, inspect labels and evidence, and call the secured Worker. `public/analyzer.js` is also the implementation imported by the connected ProdMind workflow.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Language and optional-AI status |
| `POST` | `/api/analyze` | Analyze a bounded feedback batch |
| `POST` | `/api/corrections` | Store a reviewed label correction in D1 |
| `GET` | `/api/metrics` | Return stored label and review counts |

Protected routes require the configured bearer token. Corrections and metrics require D1.

## Run, evaluate and test

```bash
cd sentiment_analyzer
npm install
npm run check
npm run evaluate
npm run dev
```

The seed evaluation verifies the harness and current rules; it is not evidence of general real-world accuracy.

## Deploy

Create the D1 database from `wrangler.jsonc`, apply `migrations/0001_initial.sql`, set `API_TOKEN`, optionally bind Workers AI, and run `npm run deploy`.

## Structure

```text
public/analyzer.js   Shared deterministic analyzer
public/              Light/dark frontend
src/worker.js        Secured API and D1 persistence
evaluation/          Small labeled seed
scripts/evaluate.js  Evaluation runner
schema/              Result and correction contracts
test/                Analyzer, evaluation and HTTP tests
```

## Honest limits

- Confidence is accumulated rule evidence, not a calibrated probability.
- Aspect detection identifies mentions, not aspect-level sentiment.
- English and Spanish coverage requires domain-specific evaluation before real use.
- Sarcasm, new slang and subtle context remain difficult.
- Human corrections are stored but do not automatically retrain the rules.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
