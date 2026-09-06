<div align="center">

# Project 7: Experiment & Learning Workspace

**Connect customer evidence to experiments, reviewed decisions, and reusable learning.**

[![ProdMind lifecycle](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![Cloudflare D1](https://img.shields.io/badge/storage-Cloudflare%20D1-F38020)](https://developers.cloudflare.com/d1/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE)

</div>

Project 7 is the connected workspace for ProdMind. It runs the implementations from Projects 1–6, preserves their evidence links, and adds the experiment lifecycle that turns a prioritized opportunity into documented learning.

The repository path remains 'experiment-data-quality-auditor/' because the original event auditor is still a core component. No duplicate Project 7 folder is required.

~~~text
Customer feedback
      ↓
Sentiment, topics and request intent
      ↓
Voice-of-Customer evidence
      ↓
Human-reviewed opportunity scoring
      ↓
Capacity-aware prioritization
      ↓
Evidence-linked experiment plan
      ↓
Event quality audit
      ↓
Analyst-reviewed decision
      ↓
Learning ledger
~~~

## Why this project exists

Product teams often lose the connection between an experiment and the customer problem that motivated it. They may also interpret conversion totals before checking whether exposure and conversion events are trustworthy.

This workspace addresses both problems:

- **Traceability:** every experiment can be followed back to its opportunity and original feedback records.
- **Quality control:** defective event snapshots are blocked before aggregates are released.
- **Human accountability:** business estimates, statistical interpretation and shipping decisions remain explicit human responsibilities.

## What works today

### Discovery and evidence

- Accepts JSON arrays, '{records: [...]}' and Feedback Collector '{data: [...]}' exports
- Normalizes records with the real Feedback Collector implementation
- Adds sentiment, topic and request-intent analysis
- Builds a Voice-of-Customer dashboard from the same enriched evidence
- Preserves distinct source IDs even when two records contain identical text
- Flags duplicate-text candidates without silently deleting customer evidence

### Opportunity review

- Suggests opportunities from discovered topics
- Requires a PM to review every scoring factor
- Captures owner, rationale, dependencies and capacity
- Rejects missing assessments and dependency cycles
- Uses Project 6 for deterministic capacity-aware prioritization
- Prevents clients from replacing server-owned evidence links

### Experiment and learning

- Creates an experiment from a selected portfolio opportunity
- Stores an immutable snapshot of its original rationale and evidence
- Supports prospective and retrospective modes
- Locks prospective plans before exposure begins
- Validates raw exposure and conversion events
- Blocks readouts with duplicate IDs, crossover, orphan conversions, invalid time order or window violations
- Requires guardrail, sample, duration and analyst-review gates
- Records ship, iterate or reject decisions against the latest audit
- Returns an opportunity-linked learning ledger

## Working interface

The responsive light/dark interface is served from [public/](public/) by [src/product-worker.js](src/product-worker.js).

From one workspace, a product manager can:

1. Enter an API token.
2. Upload feedback or load the synthetic sample.
3. Inspect enriched evidence and the Voice-of-Customer dashboard.
4. Review and rank opportunities.
5. create and lock an experiment plan.
6. Upload an event snapshot.
7. Review audit results.
8. Record a human decision.
9. Reopen the saved run and inspect the learning ledger.

The interface calls the Worker API. It is not a disconnected localStorage demonstration. The API token stays in page memory and must be entered again after reloading.

## Run the tests

Requirements: Node.js 22.13 or later.

From the ProdMind repository root:

~~~bash
node experiment-data-quality-auditor/scripts/test-all.mjs
~~~

Run only Project 7:

~~~bash
cd experiment-data-quality-auditor
node --test
~~~

The tests cover:

- original event-auditor behavior;
- the complete discovery-to-learning lifecycle;
- real SQLite migrations and revision triggers;
- authenticated HTTP routes;
- persistence across reloads;
- stale and concurrent write protection;
- evidence-lineage enforcement;
- prospective and retrospective rules;
- event-quality, sample, duration and guardrail gates.

Local tests exercise SQLite through a D1-compatible adapter. They do not claim a live Cloudflare deployment or browser visual test.

## Deploy to Cloudflare

### 1. Create the database

~~~bash
cd experiment-data-quality-auditor
npx wrangler d1 create prodmind-workflow
~~~

Copy the returned database ID into the 'database_id' field in [wrangler.jsonc](wrangler.jsonc).

### 2. Apply migrations

~~~bash
npx wrangler d1 migrations apply prodmind-workflow --local
npx wrangler d1 migrations apply prodmind-workflow --remote
~~~

### 3. Configure authentication

~~~bash
npx wrangler secret put API_TOKEN
~~~

Use a high-entropy token. Never commit it to Git.

For local development, add 'API_TOKEN=your-local-token' to the ignored '.dev.vars' file.

### 4. Run or deploy

~~~bash
npx wrangler dev
npx wrangler deploy
~~~

The six earlier modules do not require separate deployments for this connected path. Wrangler bundles their imported implementations into Project 7.

## API

All data endpoints require:

~~~http
Authorization: Bearer <token>
Content-Type: application/json
~~~

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Public service status |
| POST | /api/runs | Create discovery from feedback |
| GET | /api/runs | List the 50 latest runs |
| GET | /api/runs/:run | Reload a workflow |
| POST | /api/runs/:run/rank | Save reviewed scoring and ranking |
| POST | /api/runs/:run/experiments | Create an experiment draft |
| POST | /api/runs/:run/experiments/:id/start | Lock the plan |
| POST | /api/runs/:run/experiments/:id/readout | Audit and save an event snapshot |
| POST | /api/runs/:run/experiments/:id/decision | Record the reviewed outcome |
| GET | /api/runs/:run/learning | Retrieve linked learning |
| POST | /api/audit | Run the original stateless event audit |

Every mutation after run creation requires the latest integer 'version'. A stale request receives HTTP 409 and must reload before resubmission. Updates are never silently retried.

## Feedback contract

Each record requires:

- a unique source 'id';
- feedback 'text'; and
- a valid timestamp in 'createdAt', 'created_at' or 'timestamp'.

Text is limited to 4,000 characters. A discovery run accepts at most 100 records. Collector metadata serialized as JSON is parsed at the integration boundary.

Identical text from distinct source IDs remains as distinct evidence. Evidence count means records, not proven unique affected customers.

## Experiment-plan contract

A draft requires:

- selected 'opportunityId';
- hypothesis;
- distinct control and treatment descriptions;
- primary metric and conversion definition;
- owner;
- exact UTC start and end times;
- integer 'minimumPerArm' and sample-size rationale;
- one to ten named guardrails with explicit criteria.

The plan becomes immutable when started. Prospective plans must be locked before their start time. Historical work must use retrospective mode.

## Event-audit contract

Readouts accept one complete snapshot:

~~~json
{
  "experiment_id": "server-generated-experiment-id",
  "events": [
    {
      "event_id": "event-001",
      "experiment_id": "server-generated-experiment-id",
      "user_id": "pseudonymous-user-id",
      "variant": "control",
      "type": "exposure",
      "timestamp": "2026-09-06T10:00:00.000Z"
    }
  ]
}
~~~

Supported variants are 'control' and 'treatment'. Supported types are 'exposure' and 'conversion'. Upload a complete snapshot rather than incremental batches; incomplete windows can create misleading orphan findings.

Any implemented defect blocks the entire aggregate. The system does not silently discard bad rows and release partial results.

## Decision contract

A terminal decision includes:

- the latest 'auditId';
- outcome: ship, iterate or reject;
- reviewer;
- rationale;
- analyst 'statisticalReview';
- every guardrail name, pass/fail judgment and evidence.

A clean latest audit, completed window and minimum sample per arm are required. Failed guardrails block shipping. Retrospective experiments may record learning but cannot produce a ship decision.

## Statistical boundary

The workspace reports visitor counts, conversion counts, rates and their absolute difference. These are **descriptive**, not proof of treatment effect.

It does not calculate:

- required sample size;
- statistical significance;
- confidence intervals;
- sample-ratio mismatch;
- sequential-testing corrections;
- novelty effects; or
- causal validity.

The entered sample target is a plan supplied by the team. An analyst must review the experiment design, statistical results and stopping behavior separately. The software records a human decision; it does not generate one automatically.

## Persistence and concurrency

[migrations/0001_product_runs.sql](migrations/0001_product_runs.sql) creates:

- 'product_runs' for bounded JSON workflow snapshots; and
- 'product_run_history' for revision and stage metadata.

Each update uses a conditional version check. SQL triggers append revision history in the same transaction. The journal stores stage transitions, not complete historical snapshots.

Raw experiment user IDs are processed during auditing but are not persisted in the report. Feedback text and supplied customer identifiers are persisted.

## Security model

- The API fails closed when 'API_TOKEN' or the D1 binding is missing.
- Same-origin checks protect API requests from unrelated browser origins.
- Responses disable caching and set defensive content headers.
- One deployment represents one trusted team.
- Reviewer names are user-supplied attribution, not verified identities.
- Shared-token authentication is not account-level or tenant-level authorization.

Before using real customer data, add organization-appropriate identity, authorization, retention, audit access, backup and abuse controls.

## Project structure

~~~text
experiment-data-quality-auditor/
├── src/
│   ├── pipeline.js          Projects 1–6 integration
│   ├── lifecycle.js         Experiment state machine
│   ├── store.js             D1 persistence and version checks
│   ├── product-worker.js    Connected HTTP application
│   ├── audit.js             Deterministic event auditor
│   ├── worker.js            Original stateless audit endpoint
│   └── cli.js               Local audit CLI
├── public/                  Responsive working interface
├── migrations/              D1 schema and revision triggers
├── tests/                   Audit and lifecycle tests
├── scripts/test-all.mjs     Repository-wide test runner
├── docs/                    PRD and connected architecture
├── examples/                Synthetic audit fixture
├── wrangler.jsonc
└── README.md
~~~

## Original auditor CLI

~~~bash
node src/cli.js examples/clean.json
~~~

| Exit code | Meaning |
|---|---|
| 0 | Implemented checks passed |
| 1 | Invalid input or file error |
| 2 | Quality findings blocked aggregate release |

The included fixture proves data handling only. It is not evidence of statistical significance.

## Limits

| Area | Limit |
|---|---|
| Feedback | 100 records per run |
| Feedback text | 4,000 characters per record |
| Experiments | 20 per run |
| Readouts | 20 per experiment |
| Event snapshot | 10,000 events and 2 MB |
| Persisted workflow | 900 KB |
| Listed workflows | 50 most recent |
| Experiment window | 1–90 days |
| Outcome model | Two variants and binary conversion |

There is no live vendor connector, scheduled collection, automatic legacy-database synchronization, traffic assignment, missing-source reconciliation, trained model, multi-tenant authorization or unlimited hosting claim.

## Documentation

- [Connected architecture and contracts](docs/CONNECTED_WORKFLOW.md)
- [Product requirements](docs/PRD.md)
- [Synthetic feedback sample](public/sample-feedback.json)
- [Event-audit fixture](examples/clean.json)

## Relationship to the other projects

Project 7 directly imports:

- Feedback Collector normalization
- Sentiment Analyzer enrichment
- Topic Modeler clustering
- Feature Request Detector intent analysis
- Voice-of-Customer Dashboard aggregation
- Prioritization Engine ranking

Their standalone APIs and databases remain available and independent. The connected deployment does not silently migrate or modify existing module databases.

Project 8, [Product Outcome Monitor](../product_outcome_monitor/), consumes Project 7 decision identities through an explicit handoff and follows declared outcomes after rollout. The external AI Roadmap Optimizer is a documented planning companion, not a live dependency.

## License

New Project 7 code is [MIT licensed](LICENSE). Imported ProdMind modules retain the repository-level [Apache License 2.0](../LICENSE).
