<div align="center">

# Project 9: Product Learning Memory

**Search what the team already learned before funding the next product bet.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 9 turns completed ProdMind runs into searchable decision cards. Each result retains the original run, opportunity, experiment, decision, monitoring status, and customer-evidence IDs so historical context never becomes an unsupported recommendation.

## Product impact

- **Decision improved:** whether prior product learning is relevant enough to inform a new investigation.
- **Leading measures:** search success, evidence-linked result rate, reused learning and false-match review.
- **Portfolio value:** reduces repeated discovery work while preserving the context behind each historical decision.
- **Stop condition:** lexical similarity does not prove that customers, conditions or causal mechanisms are equivalent.

## Place in ProdMind

Projects 1–8 create the evidence-to-outcome trail. Project 9 searches that trail across recent D1 runs through the connected workspace’s `GET /api/memory` endpoint. A standalone Worker can also index explicitly supplied run exports.

## Implemented capabilities

- Learning cards built from real decided experiments
- Original evidence excerpts and IDs
- Latest Project 8 monitoring status
- Cross-run summary and monitoring coverage
- Deterministic weighted token retrieval
- Visible matching fields and terms
- Ship, iterate and reject filters
- Sustained, emerging, below-target, at-risk and unmonitored filters
- Authenticated standalone API
- Responsive system-aware light/dark frontend
- No model, embeddings, vector database, or paid service

## Retrieval weights

| Field | Weight |
|---|---:|
| Opportunity title | 5 |
| Experiment hypothesis | 4 |
| Primary metric | 3 |
| Decision rationale | 2 |
| Evidence text | 1 |

Relevance is explainable lexical overlap, not a probability or semantic-equivalence claim.

## Frontend

The standalone `public/` application uploads complete ProdMind run exports and searches them. The connected Project 7 interface searches recent D1 runs directly, so no export or duplicate database is necessary in the primary workflow.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report configuration status |
| `POST` | `/api/index` | Build a memory from up to 50 supplied runs |
| `POST` | `/api/search` | Search supplied runs with optional filters |

The connected API supports `GET /api/memory?q=onboarding&outcome=ship&status=sustained` over up to 20 recent saved runs.

## Run and deploy

```bash
cd product_learning_memory
npm install
npm test
npx wrangler secret put API_TOKEN
npx wrangler dev
# npx wrangler deploy
```

## Structure

```text
src/memory.js    Learning-card index and retrieval
src/worker.js    Authenticated standalone API
public/          Working light/dark frontend
tests/           Core and HTTP tests
docs/            PRD, architecture and metrics
```

## Honest limits

- Search is English-oriented lexical matching and may miss synonyms.
- Historical outcomes may not transfer across time, segments or product versions.
- The system does not perform causal meta-analysis.
- Search results never change a ranking, start an experiment, or authorize shipping.
- Standalone uploads may include sensitive feedback; use pseudonymous data and controlled access.

## Research foundation

- [Microsoft: trustworthy post-experiment patterns](https://www.microsoft.com/en-us/research/?p=806938)
- [Statsig: Meta-Analysis and Knowledge Bank](https://docs.statsig.com/statsig-warehouse-native/features/meta-analysis)
- [Google: continuous evaluation at experimentation scale](https://research.google/pubs/continuous-evaluation-using-ci-techniques-for-experimentation-at-scale/)

## License

[MIT](LICENSE)
