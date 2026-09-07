<div align="center">

# Project 7: Experiment & Learning Workspace

**The connected ProdMind application—from feedback evidence to monitored, reusable learning.**

[![Connected lifecycle](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 7 is both the experiment workspace and the integration host for the nine-project [ProdMind](../README.md) product. It executes Projects 1–6 directly, saves Project 8 outcome reviews, and exposes Project 9 retrieval across versioned runs.

The folder name is retained because the experiment data-quality auditor remains a core component.

## Connected lifecycle

```text
Collect → Sentiment → Topics → Requests → VoC evidence
   → Human-reviewed priority → Locked experiment
   → Event audit → Human decision → Outcome monitoring
   → Cross-run learning search
```

One D1 `product_runs` record preserves the IDs and state for this lifecycle. Clients cannot replace server-owned evidence links during prioritization or monitoring.

## Implemented capabilities

- Projects 1–5 discovery pipeline with retained feedback IDs
- Duplicate-ID rejection and similar-text review groups
- Project 6 scoring only after explicit PM assessment
- Capacity and dependency validation
- Evidence-linked experiment drafts and immutable opportunity snapshots
- Prospective plan locking and explicit retrospective mode
- Event audits for duplicates, crossovers, orphan conversions, ordering, variants and observation windows
- Sample, maturity and guardrail gates before a human decision
- Project 8 outcome persistence, reversal and guardrail signals
- Project 9 search across recent decisions and evidence
- Optimistic version checks and D1 history journal
- Authenticated, same-origin Worker API
- Responsive frontend supporting light and dark system themes

## Frontend

The application in `public/` is the primary ProdMind interface. It supports saved discovery runs, feedback uploads, opportunity assessment, ranking, experiment planning, event readouts, reviewed decisions, monitoring-snapshot uploads, and product-memory search. It uses the real Worker and D1 path; state is not stored in browser local storage.

Synthetic files are provided for feedback, event audits, and outcome monitoring.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report token and D1 configuration |
| `GET/POST` | `/api/runs` | List or create discovery runs |
| `GET` | `/api/runs/:runId` | Retrieve one versioned run |
| `POST` | `/api/runs/:runId/rank` | Save reviewed Project 6 ranking |
| `POST` | `/api/runs/:runId/experiments` | Create an experiment draft |
| `POST` | `/api/runs/:runId/experiments/:id/start` | Lock and start a plan |
| `POST` | `/api/runs/:runId/experiments/:id/readout` | Audit an event snapshot |
| `POST` | `/api/runs/:runId/experiments/:id/decision` | Save a reviewed decision |
| `GET` | `/api/runs/:runId/learning` | Return decisions and outcome reviews |
| `POST` | `/api/runs/:runId/learning/:id/monitor` | Save a Project 8 review |
| `GET` | `/api/memory?q=...` | Search Project 9 learning memory |
| `POST` | `/api/audit` | Use the original standalone event auditor |

Every mutation requires the current integer `version`. A stale writer receives HTTP 409.

## Run and test

Node.js 22.13 or later is recommended.

```bash
cd experiment-data-quality-auditor
npm test
npm run demo
```

Run every repository module from the root:

```bash
node experiment-data-quality-auditor/scripts/test-all.mjs
```

## Deploy

```bash
npx wrangler d1 create prodmind-workflow
# place the returned ID in wrangler.jsonc
npx wrangler d1 migrations apply prodmind-workflow --remote
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Projects 1–6, 8, and 9 are bundled through imports for this deployment. Their standalone databases are not automatically copied into the workspace.

## Structure

```text
src/pipeline.js         Projects 1–6 discovery and ranking
src/lifecycle.js        Experiments, decisions and Project 8 monitoring
src/audit.js            Deterministic event-quality audit
src/product-worker.js   Connected authenticated API
src/store.js            Versioned D1 persistence
public/                 Complete nine-stage workspace
migrations/             Product-run and history schema
tests/                  Audit, workflow, HTTP and persistence tests
docs/                   PRD and connected contracts
```

## Decision boundaries

- Topic labels and classifiers are suggestions requiring review.
- Product-value estimates come from a PM, not inferred feedback volume.
- Counts and rate differences do not establish significance or causality.
- Retrospective analysis cannot authorize shipping.
- Project 8 monitoring signals do not prove that a decision caused a change.
- Project 9 retrieval supplies historical context, not an automatic recommendation.

## Security and limits

The Worker fails closed without D1 and `API_TOKEN`, blocks cross-origin API calls, limits payload sizes, and excludes raw experiment user IDs from persisted reports. It remains a single-team deployment, not tenant-isolated SaaS. See [CONNECTED_WORKFLOW.md](docs/CONNECTED_WORKFLOW.md) for exact contracts and limits.

## License

Project 7 code is [MIT licensed](LICENSE). Imported modules retain their original licenses.
