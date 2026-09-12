<div align="center">

# Project 3: Topic Modeler

**Group feedback into inspectable themes while retaining document links.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Project 3 converts enriched feedback into lightweight topics, weighted keywords, document assignments, a topic hierarchy, and a descriptive drift signal. Every assignment retains the Project 1 evidence ID used by downstream opportunities.

## Product impact

- **Decision improved:** which recurring customer problems deserve structured investigation.
- **Leading measures:** assignment coverage, topic concentration, unassigned records and reviewed drift signals.
- **Portfolio value:** compresses a bounded evidence set while keeping every topic traceable to source records.
- **Stop condition:** topic IDs are run-scoped suggestions, not stable customer-problem truth across time.

## Place in ProdMind

```text
Normalized feedback + sentiment
             ↓
      Project 3 topics
             ↓
Request evidence + VoC dashboard + opportunities
```

The connected workspace imports `modelTopics` from `public/topic-modeler.js` and joins assignments back to feedback by document ID.

## Implemented capabilities

- Unicode-aware tokenization and accent normalization
- English and Spanish stop-word filtering
- Sparse weighted document vectors
- Cosine-similarity grouping
- Weighted topic keywords and labels
- Document-to-topic assignments
- Lightweight hierarchical grouping
- KL-divergence drift description for bounded time windows
- Optional D1 run, topic and assignment history
- Authenticated Worker analysis and responsive light/dark frontend

No BERTopic, transformer embedding, River, Dask, Python, or external vector database package is present.

## Frontend

The static application in `public/` loads feedback JSON, runs the same deterministic topic implementation, and renders topics, keywords, assignments, hierarchy and drift. The Worker provides the secured and optionally persisted path.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report service and D1 status |
| `POST` | `/api/topics/analyze` | Build topics from a bounded document collection |
| `GET` | `/api/runs` | List persisted runs when D1 is configured |

## Run and test

```bash
cd topic_modeler
npm install
npm run check
npm run dev
```

## Deploy

Create the D1 database declared in `wrangler.jsonc`, apply the migration, set `API_TOKEN`, configure allowed origins, and run `npm run deploy`.

## Structure

```text
public/topic-modeler.js  Shared topic implementation
public/                  Working frontend
src/worker.js            Authenticated API and D1 writes
migrations/              Topic-run persistence
schema/                  Document and result contracts
examples/                Synthetic feedback
test/                    Core and Worker tests
```

## Honest limits

- Lexical similarity does not understand arbitrary synonyms or semantic equivalence.
- Topic IDs belong to one run; stable cross-run topic identity is not implemented.
- Drift is descriptive and not a calibrated alert.
- Topic labels are generated from weighted terms and require human review.
- Small or highly diverse collections may produce weak themes.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
