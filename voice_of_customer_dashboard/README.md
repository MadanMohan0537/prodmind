<div align="center">

# ProdMind Voice-of-Customer Dashboard

**See what customers are saying, which groups are affected, and what changed.**

Evidence-first · Local-first · Explainable anomalies · Cloudflare-ready · Zero paid APIs

![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![Tests](https://img.shields.io/badge/tests-16%20passing-22c55e)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../LICENSE)

</div>

Voice-of-Customer Dashboard is project 05 in [ProdMind](../README.md). It turns normalized, enriched feedback into an interactive customer-intelligence view without hiding the underlying evidence or requiring a paid analytics platform.

It answers four practical questions:

1. What are customers talking about?
2. Which sources and customer segments are contributing?
3. How are volume and sentiment changing over time?
4. Which changes deserve a human review?

## At a glance

| | |
|---|---|
| **Users** | Product managers, founders, UX researchers, customer-success teams, and support leaders |
| **Input** | Feedback Collector-compatible events enriched with sentiment, topics, and intents |
| **Output** | KPIs, trends, topic/source/segment distributions, anomaly alerts, and source evidence |
| **Runtime** | Browser-local dashboard or authenticated Cloudflare Worker API |
| **Persistence** | Optional Cloudflare D1 history with fingerprint-based duplicate protection |
| **Cost posture** | No paid model, database, visualization library, or analytics service is required |

## Product flow

```mermaid
flowchart TD
  A[Feedback Collector events] --> B[Normalize and validate]
  B --> C[Filter and aggregate]
  C --> D[Trends and distributions]
  C --> E[Anomaly detection]
  D --> F[Evidence dashboard]
  E --> F
  B --> G[(Optional D1 history)]
```

The browser and Worker import the same `public/analytics.js` module. Local analysis and deployed API analysis therefore use the same normalization, filtering, aggregation, and alert logic.

## What is implemented

- Responsive dashboard with system-aware light and dark themes
- Browser-local JSON analysis with no network submission
- Filters for source, segment, topic, date range, and evidence text
- Feedback volume and average-sentiment daily trends
- Topic, source, segment, and intent distributions
- Unique-known-customer and negative-feedback metrics
- Evidence stream linked to every aggregate
- Explainable rolling-baseline volume-spike and sentiment-drop alerts
- Normalized contract compatible with earlier ProdMind modules
- Authenticated single-request and batch APIs
- Strict CORS allowlist, CSP, bounded inputs, and no-store responses
- Optional D1 storage with SHA-256 fingerprint deduplication
- Versioned JSON schemas, sample events, tests, and evaluation harness

## Honest scope

| Capability | Status | Boundary |
|---|---|---|
| Local dashboard | Implemented | Paste JSON or load the sample dataset |
| Stateless dashboard API | Implemented | Up to 10,000 events per analysis |
| D1 ingestion | Implemented | Up to 500 events per request |
| D1 historical dashboard | Implemented | Reads a bounded recent window |
| Anomaly detection | Implemented | Transparent rolling statistical baseline |
| Live refresh | Manual/API-driven | No background connector polling in this module |
| WebSocket streaming | Planned | Not represented as implemented |
| Enterprise RBAC and tenant isolation | Planned | Bearer-token demo security only |
| ClickHouse/Druid/Flink/Spark | Deliberately deferred | Unnecessary for the zero-cost MVP workload |

## Quick start

Requires Node.js 20 or newer.

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/voice_of_customer_dashboard
npm install
npm test
npm run dev
```

Open the local URL printed by Wrangler and press **Load sample**. Analysis happens in the browser and does not require an API token or D1 database.

## Event contract

Only `text` is required. Earlier ProdMind modules can progressively enrich the rest of the record.

```json
{
  "id": "ticket-42",
  "timestamp": "2026-09-01T12:00:00Z",
  "source": "support",
  "segment": "New SMB",
  "customerId": "customer-7",
  "text": "Setup keeps returning me to step one.",
  "sentiment": -0.8,
  "topics": ["onboarding", "reliability"],
  "intents": ["bug-report", "complaint"],
  "metadata": {}
}
```

The detector also accepts a sentiment object containing `score`, comma-separated topics, and intent objects containing `label`. See [`schema/`](schema/) for the versioned documentation contracts.

## API

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service and persistence status |
| `POST` | `/api/dashboard` | Bearer token | Build a stateless dashboard from supplied events |
| `POST` | `/api/events` | Bearer token | Validate, deduplicate, and optionally persist up to 500 events |
| `GET` | `/api/dashboard` | Bearer token | Build a dashboard from D1 history |

Stateless analysis:

```bash
curl -X POST http://localhost:8787/api/dashboard \
  -H 'Authorization: Bearer local-development-token' \
  -H 'Content-Type: application/json' \
  --data @examples/sample-events.json
```

Historical filters are query parameters:

```text
/api/dashboard?source=support&segment=New%20SMB&topic=onboarding&from=2026-08-01&to=2026-09-01
```

## Dashboard metrics

| Metric | Definition |
|---|---|
| Total feedback | Records remaining after filters |
| Known customers | Distinct non-anonymous customer IDs |
| Average sentiment | Mean bounded sentiment score from −1 to +1 |
| Needs attention | Records with sentiment below −0.2 |
| Distribution share | Dimension count divided by filtered record count |

These are descriptive signals, not business-impact estimates. Customer counts are only meaningful when upstream systems provide stable, consented identifiers.

## Explainable anomaly detection

For each daily point, the engine compares volume and sentiment with a rolling recent window:

- A **volume spike** is raised when the current count exceeds the recent mean by the configured z-score threshold.
- A **sentiment drop** is raised when current average sentiment falls below the recent baseline by the configured point threshold.
- Every alert contains its date, observed value, baseline, score, severity, and a plain-language explanation.

The defaults use a seven-day window, a `2.0` volume threshold, and a `0.3` sentiment-drop threshold. Sparse histories require at least two preceding daily observations. Alerts indicate unusual movement; they do not prove root cause.

## Cloudflare deployment

Create the optional D1 database:

```bash
npx wrangler d1 create voice-of-customer-db
```

Replace the placeholder database ID in `wrangler.jsonc`, then configure and deploy:

```bash
npm run db:migrate:remote
npx wrangler secret put API_TOKEN
npm run deploy
```

Set `ALLOWED_ORIGINS` to the exact deployed UI origin. For stateless API operation, remove the D1 binding. For local authenticated API testing, create an untracked `.dev.vars` file containing `API_TOKEN="local-development-token"`.

## Security and privacy

- Browser-local mode does not transmit feedback.
- API access fails closed if `API_TOKEN` is absent.
- Cross-origin API access requires an exact allowlisted origin.
- Bearer tokens are compared as fixed-length SHA-256 digests.
- Request, batch, text, analysis, and query sizes are bounded.
- Responses use CSP, `nosniff`, no-referrer, and no-store headers.
- SQL statements are parameterized and duplicate fingerprints are unique.
- Evidence is escaped before browser rendering.
- Internal exceptions are replaced with a request identifier.

D1 stores raw feedback text to preserve evidence traceability. Before using customer data, establish consent, minimization, redaction, retention, deletion, access, and tenant-isolation policies. A shared bearer token is suitable for a portfolio demo, not a public multi-tenant product.

## Testing and evaluation

```bash
npm run check
npm run evaluate
```

The automated suite covers normalization, filtering, aggregates, empty input, anomaly detection, parsing, analysis bounds, public health, static assets, authentication, CORS, stateless analysis, persistence boundaries, invalid JSON, and unknown routes.

The bundled evaluation cases verify known aggregates and filters. They test the machinery, not real-world anomaly precision. Before production use, evaluate alert precision, missed incidents, time-to-detection, evidence traceability, dashboard adoption, and decision usefulness on anonymized domain data.

## Repository structure

```text
public/analytics.js     Shared normalization, filters, aggregates, and anomalies
public/index.html       Accessible dashboard shell
public/app.js           Local analysis and evidence rendering
public/styles.css       Responsive system-aware light/dark interface
src/worker.js           Authenticated API, CORS, ingestion, and D1 queries
migrations/             D1 event store and indexes
schema/                 Versioned event and dashboard contracts
examples/               Ready-to-run sample payload
evaluation/             Labeled aggregate/filter cases
scripts/evaluate.js     Deterministic evaluation runner
test/                   Analytics and Worker route tests
wrangler.jsonc          Cloudflare configuration
```

## Integration with ProdMind

- **Feedback Collector** supplies normalized, deduplicated records.
- **Sentiment Analyzer** supplies bounded sentiment scores and evidence.
- **Topic Modeler** supplies topics and hierarchical themes.
- **Feature Request Detector** supplies multi-label intents.
- **Voice-of-Customer Dashboard** combines those independent signals without treating any one classifier as product priority.

## Roadmap

1. Add saved views and human-owned alert acknowledgements.
2. Add time-zone-aware granularity and comparison periods.
3. Add privacy-preserving scheduled refresh for one authenticated connector.
4. Evaluate anomaly thresholds on labeled historical incidents.
5. Add Cloudflare Durable Objects only if collaborative live sessions require them.
6. Add tenant identity, roles, audit logs, and retention controls before multi-tenant use.
7. Evaluate OLAP infrastructure only after measured D1/query limits justify it.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
