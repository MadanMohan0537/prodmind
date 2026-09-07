<div align="center">

# Project 9: Product Learning Memory

**Search what the product team already learned before funding the next bet.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE)

</div>

ProdMind Projects 1–8 create a strong evidence trail: customer feedback becomes an opportunity, an experiment, a reviewed decision, and a monitored outcome. Project 9 turns those completed runs into a searchable institutional memory without detaching conclusions from their source evidence.

```text
Projects 1–5 evidence
        ↓
Project 6 priority
        ↓
Project 7 experiment and decision
        ↓
Project 8 monitored outcome
        ↓
Project 9 searchable learning card
```

## Why this is the next viable product

The next bottleneck is no longer generating another analysis. It is recovering what the team already learned. Microsoft’s post-experiment guidance recommends closing the loop and using collections of prior results for meta-analysis. Statsig similarly exposes a searchable experiment Knowledge Bank. Project 9 brings that capability into ProdMind while retaining the evidence chain and conservative decision boundaries.

## What works

- Builds learning cards from real ProdMind run snapshots
- Preserves run, opportunity, experiment, decision, monitor and evidence identities
- Includes bounded evidence excerpts for direct inspection
- Searches opportunity titles, hypotheses, primary metrics, rationales and evidence
- Weights matches deterministically and reports matched fields and terms
- Filters ship, iterate and reject decisions
- Filters sustained, emerging, below-target, at-risk and unmonitored outcomes
- Reports monitoring coverage and unique supporting evidence
- Runs as part of the connected ProdMind Worker or as a standalone Worker
- Requires no model API, vector database or paid service

## Retrieval behavior

| Field | Weight |
|---|---:|
| Opportunity title | 5 |
| Experiment hypothesis | 4 |
| Primary metric | 3 |
| Decision rationale | 2 |
| Evidence text | 1 |

Results explain their matches. This makes the MVP inspectable and inexpensive, but it is lexical retrieval—not semantic equivalence. A returned historical decision is context for human review, not an instruction to repeat it.

## Run locally

```bash
cd product_learning_memory
npm test
npx wrangler secret put API_TOKEN
npx wrangler dev
```

For local development, store `API_TOKEN=your-local-token` in the ignored `.dev.vars` file.

## Standalone API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Report configuration status |
| POST | `/api/index` | Build a memory from complete ProdMind runs |
| POST | `/api/search` | Search runs with optional decision and outcome filters |

Authenticated requests use `Authorization: Bearer <token>`. Input is limited to 50 runs and 2 MB.

Example search body:

```json
{
  "runs": [],
  "query": "onboarding activation",
  "filters": {"outcome": "ship", "status": "sustained"}
}
```

## Connected ProdMind path

The primary product path is the Project 7 workspace. Its authenticated `GET /api/memory?q=onboarding` endpoint loads recent versioned runs from the existing D1 database and invokes Project 9 directly. No export, duplicated database, or external synchronization is required.

## Project structure

```text
product_learning_memory/
├── src/memory.js       Indexing and explainable retrieval
├── src/worker.js       Authenticated standalone API
├── public/             Responsive light/dark interface
├── tests/              Core and HTTP verification
├── docs/               PRD, architecture and metrics
├── wrangler.jsonc
└── README.md
```

## Research foundation

- [Microsoft: Patterns of Trustworthy Experimentation—Post-Experiment Stage](https://www.microsoft.com/en-us/research/?p=806938)
- [Microsoft: Online Experimentation at Microsoft](https://www.microsoft.com/en-us/research/publication/online-experimentation-at-microsoft/)
- [Statsig: Meta-Analysis and Knowledge Bank](https://docs.statsig.com/statsig-warehouse-native/features/meta-analysis)
- [Google: Continuous Evaluation at Experimentation Scale](https://research.google/pubs/continuous-evaluation-using-ci-techniques-for-experimentation-at-scale/)

## Limits and safety

- Search is English-oriented lexical matching.
- Relevance scores are ranking signals, not calibrated probabilities.
- Historical outcomes may not transfer across segments, seasons or product versions.
- Project 9 never changes priorities, starts experiments or recommends shipping.
- One connected deployment remains one trusted team; a shared token is not tenant isolation.

## License

[MIT](LICENSE)
