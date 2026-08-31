# ProdMind

ProdMind is a zero-cost, Cloudflare-native product management copilot. It is being built through **divide and conquer**: each capability ships as an independently useful, tested product slice before it becomes part of the wider platform.

## Slice 01: Feedback Collector

The first slice turns CSV, JSON, and manually entered customer feedback into a normalized stream. It currently provides:

- CSV and JSON import in the browser
- A normalized feedback schema
- Exact semantic-order deduplication
- Lightweight sentiment and intent classification
- A feedback inbox and summary dashboard
- Local-first persistence with no paid database
- A Cloudflare Worker health endpoint
- Responsive, accessible UI
- Automated unit tests

No paid APIs, hosted models, databases, queues, or third-party SaaS products are required.

## Architecture

```text
Browser input -> normalize -> deduplicate -> classify -> local store -> dashboard
```

This slice deliberately uses a modular monolith. Domain logic lives in `public/feedback.js`, UI orchestration in `public/app.js`, and Cloudflare routing in `src/worker.js`. Later slices can reuse these contracts without prematurely creating separate services.

## Run locally

```bash
npm install
npm test
npm run dev
```

## Deploy to Cloudflare

```bash
npm run deploy
```

Alternatively, connect this repository in Cloudflare Workers & Pages and enable automatic deployments from `main`. The included `wrangler.jsonc` serves the static application and Worker API together.

## Import format

CSV headers or JSON keys may use `text`, `feedback`, `comment`, or `review` for the feedback body. Optional fields include `source`, `customer`, `user`, `timestamp`, and `createdAt`.

```csv
text,source,customer
Please add CSV export,Support,Acme
The mobile filter crashes,App review,Anonymous
```

## Product roadmap

1. **Feedback foundation** — ingestion, normalization, deduplication (current)
2. **Customer intelligence** — topic clustering, evidence review, human corrections
3. **Decision intelligence** — opportunity grouping and explainable prioritization
4. **Planning** — PRDs, user stories, roadmaps, and exports
5. **Measurement** — experiments, adoption, retention, and impact
6. **Market intelligence** — competitors, trends, and feature gaps

Every slice must be useful independently, pass its tests, fit the Cloudflare free tier, and avoid paid dependencies before integration.

## License

[MIT](LICENSE)
