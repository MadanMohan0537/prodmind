<div align="center">

# Feedback Collector

**Turn scattered customer comments into a clean, structured stream of product evidence.**

CSV + JSON import · Normalization · Deduplication · Intent detection · Cloudflare-ready

</div>

Feedback Collector is project 01 of ProdMind. It provides the trustworthy input layer required by the Sentiment Analyzer, Topic Modeler, Feature Request Detector, and Voice-of-Customer Dashboard.

## What it does

1. Accepts manually entered feedback or CSV/JSON files.
2. Maps fields such as `text`, `feedback`, `comment`, and `review` into one schema.
3. Cleans whitespace and validates required content.
4. Removes duplicate feedback using a deterministic fingerprint.
5. Classifies sentiment and intent without a paid model API.
6. Presents source coverage, requests, negative signals, and the normalized inbox.
7. Stores the prototype dataset locally so no paid database is required.

The production path adds a versioned ingestion API, Cloudflare D1 persistence, optional Cloudflare Queue processing, ingestion-job auditing, retry/backoff connector utilities, rate limiting, idempotent writes, and JSONL event export. If cloud bindings are absent, the interface still works locally in the browser.

## Included source adapters

- CSV and JSON file imports
- Generic paginated JSON API connector
- Zendesk ticket mapping template
- Intercom conversation mapping template
- Typeform response mapping template
- Reddit post/comment mapping template

Authenticated connectors intentionally accept credentials through Cloudflare secrets at deployment time; no tokens are stored in this repository.

## Run it now

```bash
npm install
npm test
npm run dev
```

## Import format

```csv
text,source,customer
Please add CSV export,Support,Acme
The mobile filter crashes,App review,Anonymous
```

JSON arrays are supported. Optional metadata includes `source`, `customer`, `user`, `timestamp`, and `createdAt`.

## Architecture

```text
Browser input -> validate -> normalize -> deduplicate -> classify -> local store -> inbox
```

- `public/feedback.js` contains reusable domain logic.
- `public/app.js` controls imports, persistence, and rendering.
- `src/worker.js` serves the application and health API on Cloudflare.
- `test/feedback.test.js` verifies the normalization pipeline.

## Cloudflare deployment

```bash
npx wrangler d1 create feedback-collector-db
npx wrangler queues create feedback-ingestion
# Copy the returned D1 database ID into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

Both D1 and Queues fit Cloudflare's free allowances for an MVP. Workers AI, Vectorize, a paid model, Kafka, Kubernetes, and external data warehouses are not required.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Runtime, schema, and storage status |
| `POST` | `/api/feedback` | Submit one record or a batch of up to 1,000 |
| `GET` | `/api/feedback` | Read normalized events, optionally filtered by source |
| `GET` | `/api/jobs/:id` | Inspect asynchronous ingestion status |
| `GET` | `/api/export` | Download normalized events as JSONL |

## Normalized event contract

Every accepted event receives a schema version, source, timestamp, normalized customer and text fields, sentiment, intent, metadata, and a SHA-256 content fingerprint. The contract is defined in `schema/feedback-event.schema.json`; database evolution is tracked in `migrations/`.

## Reliability and safety

- Exponential backoff with jitter for transient connector failures
- `Retry-After` support for upstream throttling
- Per-minute API rate limiting
- Queue retry policy with terminal failure auditing
- Unique content fingerprints and idempotent D1 inserts
- Maximum API batch sizes
- Parameterized SQL queries
- No credentials committed to source control
- Original feedback retained as normalized evidence with extensible metadata

## Next increment

- Robust quoted CSV parsing
- Import preview and column mapping
- IndexedDB storage for larger datasets
- Configurable taxonomy and confidence scoring
- OAuth setup screens for live third-party connectors

## License

Apache-2.0. See the repository-level `LICENSE`.
