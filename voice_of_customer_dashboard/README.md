<div align="center">

# Project 5: Voice-of-Customer Dashboard

**Turn enriched feedback into traceable trends, segments, and evidence views.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Project 5 combines the normalized records, sentiment, topics, and request intents produced by Projects 1–4. It calculates bounded aggregates and exposes the records behind them so a PM can inspect evidence before assessing an opportunity.

## Place in ProdMind

```text
Projects 1–4 enriched evidence
              ↓
 Project 5 dashboard and signals
              ↓
 Human-reviewed opportunities → Project 6
```

The connected workspace imports `buildDashboard` and persists its output in the same discovery run as the original evidence.

## Implemented capabilities

- Source, segment, topic, query and date filtering
- Total feedback, sentiment and intent summaries
- Source, segment and topic breakdowns
- Evidence retrieval with original IDs
- Deterministic volume-spike and sentiment-drop signals
- Stateless dashboard analysis
- Optional D1 event ingestion and dashboard history
- Bounded input validation and duplicate protection
- Responsive light/dark dashboard frontend
- Labeled aggregate/filter evaluation fixture

## Frontend

`public/index.html`, `public/app.js`, `public/analytics.js`, and `public/styles.css` provide a deployable dashboard. The browser can analyze a local synthetic dataset; the secured Worker supports stateless analysis or persisted D1 history.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report service and persistence status |
| `POST` | `/api/events` | Validate and persist enriched events |
| `POST` | `/api/dashboard` | Analyze a supplied event collection |
| `GET` | `/api/dashboard` | Query persisted dashboard history |

## Run, evaluate and test

```bash
cd voice_of_customer_dashboard
npm install
npm run check
npm run evaluate
npm run dev
```

## Deploy

Create the D1 database, apply `migrations/0001_initial.sql`, set `API_TOKEN` and allowed origins, then run `npm run deploy`.

## Structure

```text
public/analytics.js  Shared filters, aggregates and signals
public/              Dashboard interface
src/worker.js        Secured API and D1 queries
migrations/          VoC event store
schema/              Event and dashboard contracts
evaluation/          Aggregate/filter fixture
test/                Analytics and route tests
```

## Honest limits

- Anomaly thresholds are deterministic heuristics, not trained incident detectors.
- Feedback counts are records, not necessarily unique customers.
- Topic and sentiment quality depends on upstream review.
- No scheduled connector refresh, acknowledgements, tenant isolation, or notification delivery is implemented.
- The dashboard supports product judgment; it does not decide what to build.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
