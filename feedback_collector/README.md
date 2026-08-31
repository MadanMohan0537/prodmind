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
npm run deploy
```

The current slice requires no D1 database, Queue, Vectorize index, or paid AI model.

## Next increment

- Robust quoted CSV parsing
- Import preview and column mapping
- Source-specific connector contracts
- IndexedDB storage for larger datasets
- Configurable taxonomy and confidence scoring
- Normalized JSONL export

## License

Apache-2.0. See the repository-level `LICENSE`.
