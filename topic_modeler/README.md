<div align="center">

# ProdMind Topic Modeler

**Turn unstructured feedback into explainable themes, hierarchies, and drift signals.**

Local-first · Zero paid APIs · Cloudflare-ready · Apache-2.0

</div>

Topic Modeler is project 03 in [ProdMind](../README.md). It incrementally groups feedback, explains each topic with weighted terms, builds a lightweight hierarchy, and detects changes between time windows. The usable baseline runs in the browser and on Cloudflare Workers; an optional Python research package covers BERTopic, transformer embeddings, River, and Dask.

## What is included

| Capability | Browser / Worker | Optional Python research |
|---|---:|---:|
| Online sparse-vector clustering | Yes | River K-Means |
| Topic labels and keywords | Weighted class TF-IDF | BERTopic c-TF-IDF |
| Time decay and source reliability | Yes | Yes |
| Hierarchical topic grouping | Cosine grouping | BERTopic hierarchy |
| Topic drift | KL divergence | KL divergence |
| Distributed preprocessing | Not applicable | Dask |
| Paid service required | No | No |

This separation is deliberate. Cloudflare Workers cannot execute Python transformer models, BERTopic, or Dask. The Worker provides a fast deterministic production baseline; the research package trains richer models using free local hardware or a free notebook.

## Architecture

```mermaid
flowchart TD
  A[Feedback documents] --> B[Validate and tokenize]
  B --> C[Online cosine clustering]
  C --> D[Weighted c-TF-IDF]
  D --> E[Topics and assignments]
  E --> F[Hierarchy]
  E --> G[KL drift]
  E --> H[(Optional D1 history)]
```

## Quick start

Requires Node.js 20 or newer.

```bash
cd topic_modeler
npm install
npm test
npm run dev
```

Open `http://localhost:8787`. The interface models pasted text locally, so no token or database is needed for the demo.

## API

All API routes except health require a bearer token.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service and persistence status |
| `POST` | `/api/topics/analyze` | Model up to 1,000 documents and optionally persist the run |
| `GET` | `/api/runs` | Read the latest 100 persisted model runs |

Example:

```bash
curl -X POST http://localhost:8787/api/topics/analyze \
  -H 'Authorization: Bearer local-development-token' \
  -H 'Content-Type: application/json' \
  --data @examples/sample-feedback.json
```

Each document accepts `id`, `text`, `source`, `timestamp`, and `reliability` from 0 to 1. Analysis options include `similarityThreshold`, `hierarchyThreshold`, and `halfLifeDays`. Contracts live in [`schema/`](schema/).

## Configure and deploy to Cloudflare

1. Create a free D1 database:

   ```bash
   npx wrangler d1 create topic-modeler-db
   ```

2. Replace the placeholder `database_id` in `wrangler.jsonc` and set the browser origins allowed to call the API.

3. Apply the migration:

   ```bash
   npm run db:migrate:remote
   ```

4. Add a strong API token without committing it:

   ```bash
   npx wrangler secret put API_TOKEN
   ```

5. Deploy:

   ```bash
   npm run deploy
   ```

For local API testing, create an untracked `.dev.vars` containing `API_TOKEN="local-development-token"`. D1 is optional; omit the binding if you only need stateless analysis.

## How the baseline works

1. Text is normalized, tokenized, and stripped of English and Spanish stop words.
2. Each document becomes a normalized sparse term-frequency vector.
3. Documents arrive one at a time and join the nearest centroid above the similarity threshold; otherwise they create a topic.
4. Topic terms receive class TF-IDF scores multiplied by exponential time decay and source reliability.
5. Similar topic centroids form parent groups.
6. The corpus is split chronologically and KL divergence measures vocabulary change.

Every result includes the model identifier, options, terms, assignments, similarity, sources, topic shares, hierarchy, and drift score. This makes the output inspectable instead of presenting topic labels as unexplained facts.

## Optional BERTopic pipeline

The [`ml/`](ml/) package implements the original research direction:

```bash
cd ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/train_bertopic.py data/sample.jsonl
python -m unittest discover -s tests
```

It includes BERTopic with MiniLM embeddings, River incremental clustering, BERTopic hierarchy export, weighted c-TF-IDF utilities, KL drift, and Dask preprocessing. See [`ml/README.md`](ml/README.md) for the boundary between research and deployment.

## Security and privacy

- Browser analysis is local and sends no text to a server.
- The Worker fails closed when `API_TOKEN` is absent.
- CORS reflects only origins listed in `ALLOWED_ORIGINS`; it is never `*`.
- Tokens are compared as SHA-256 digests.
- Input length and batch size are bounded.
- D1 statements are parameterized.
- Persistence writes are split into bounded D1 batches.
- Browser-rendered topic labels and terms are HTML-escaped.
- API responses use `nosniff` and disable caching.

The bearer token protects a small private deployment. For a multi-user service, add Cloudflare Access or per-user authentication and a distributed rate limiter before exposing it publicly.

## Test and validate

```bash
npm run check
python -m unittest discover -s ml/tests
python -m py_compile ml/src/*.py
```

Tests cover tokenization, cosine similarity, topic creation, assignments, hierarchy, KL drift, validation, authorization, CORS, HTTP analysis, and the dependency-free Python weighting/drift functions.

## Honest limitations

- Sparse lexical similarity is fast and transparent but does not understand synonyms as well as embeddings.
- Topic IDs are scoped to a run; long-term identity matching is future work.
- “Online” describes incremental assignment within one analysis run; the baseline does not yet carry centroids across requests.
- The simple chronological midpoint is a useful drift signal, not a statistical alarm system.
- English and Spanish stop words are included; other languages work lexically but need tuned stop-word lists.
- Browser analysis does not persist. Worker history needs D1.
- BERTopic quality depends on corpus size, language, embeddings, and parameter tuning.

## Roadmap

- Stable cross-run topic identity and merge/split events
- Sliding and calendar-based drift windows
- Human rename/merge/split controls
- Import from Feedback Collector's versioned event schema
- Export compact trained topic metadata to the Worker
- Evaluation dataset with topic-coherence and assignment-quality reports

## License

Licensed under the repository's [Apache License 2.0](../LICENSE).
