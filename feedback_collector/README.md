<div align="center">

# Project 1: Feedback Collector

**Normalize customer feedback into one traceable event stream.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Feedback Collector is the ingestion boundary for [ProdMind](../README.md). It accepts individual records or bounded batches, validates the normalized contract, creates a canonical SHA-256 fingerprint, and stores unique feedback in Cloudflare D1. Original source IDs remain available for every downstream decision.

## Product impact

- **Decision improved:** whether incoming customer evidence is trustworthy enough to enter discovery.
- **Leading measures:** accepted, rejected and duplicate records; connector success; unresolved validation errors.
- **Portfolio value:** prevents every downstream insight from inheriting malformed, repeated or untraceable evidence.
- **Stop condition:** ingestion success never proves that feedback is representative; Project 11 evaluates evidence fitness later.

## Place in ProdMind

```text
Feedback sources → Project 1 normalization
                 → Projects 2–5 enrichment
                 → Project 6 prioritization
                 → Projects 7–9 learning loop
```

The connected workspace imports `prepareRecord` directly. Standalone D1 data is not silently synchronized; export it and submit the resulting records to the connected workspace.

## Implemented capabilities

- JSON and CSV ingestion through the browser
- Required ID, source, timestamp, text and metadata validation
- Shared canonical fingerprint behavior in browser and Worker
- D1 duplicate protection with `INSERT OR IGNORE`
- Optional Cloudflare Queue ingestion
- D1-backed rate counters and ingestion-job status
- Authenticated list and export endpoints
- Same-origin or configured-origin CORS enforcement
- Generic paginated JSON mapping plus Zendesk mapping and retry utilities
- Responsive frontend with light and dark color schemes

The Worker schedules the configured Zendesk connector hourly through a Cron Trigger. Other connector shapes remain mapping utilities rather than live scheduled integrations.

## Frontend

`public/index.html`, `public/app.js`, `public/feedback.js`, and `public/styles.css` provide a deployable interface for manual entry, CSV/JSON import, API configuration, saved-record refresh, and JSON export. The interface calls the real Worker API rather than maintaining a separate demo-only dataset.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Public service and storage status |
| `POST` | `/api/feedback` | Validate and ingest one record or a batch |
| `GET` | `/api/feedback` | List recent normalized feedback |
| `GET` | `/api/jobs/:id` | Inspect an ingestion job |
| `GET` | `/api/export` | Export up to 10,000 stored records |

Protected endpoints require `Authorization: Bearer <API_TOKEN>`.

## Run and test

```bash
cd feedback_collector
npm install
npm run check
npm run dev
```

Use the synthetic files in `examples/`; never commit real customer information.

## Deploy

1. Create the D1 database and optional Queue declared in `wrangler.jsonc`.
2. Replace placeholder resource IDs.
3. Apply `migrations/0001_initial.sql`.
4. Set `API_TOKEN` and connector credentials with Wrangler secrets.
5. Run `npm run deploy`.

Cloudflare quotas still apply even though the project requires no paid model or third-party API.

## Structure

```text
src/             Worker routes, normalization and connectors
public/          Light/dark frontend and shared browser utilities
migrations/      D1 tables, indexes and rate counters
schema/          Normalized feedback JSON Schema
examples/        Synthetic CSV and JSON
test/            Core, connector and HTTP tests
wrangler.jsonc   Cloudflare bindings
```

## Honest limits

- Only the Zendesk connector has an exercised fetch-and-pagination test.
- Zendesk has an hourly Cron Trigger; the other mapping templates have no scheduled synchronization or credential-management UI.
- Similar text is a review signal; it is not proof that two customers are duplicates.
- A bearer token protects a small trusted deployment, not a multi-tenant SaaS product.
- Configure retention, redaction, access control and abuse protection before using sensitive feedback.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
