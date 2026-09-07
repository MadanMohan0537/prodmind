<div align="center">

# ProdMind

**An evidence-to-learning operating system for product teams.**

[![Connected lifecycle](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-2563EB.svg)](LICENSE)

</div>

ProdMind connects nine focused product-management modules into one traceable workflow. It starts with raw customer feedback, builds reviewed opportunities, supports prioritization and experimentation, follows outcomes, and makes completed learning searchable without losing the original evidence.

Every module remains independently runnable. Project 7 provides the connected workspace and shared lifecycle.

~~~text
Customer feedback
      ↓
Normalize and validate
      ↓
Sentiment, topics and request intent
      ↓
Voice-of-Customer evidence
      ↓
Human-reviewed prioritization
      ↓
Experiment plan and event audit
      ↓
Human decision and learning ledger
      ↓
Post-decision outcome monitoring
      ↓
Searchable product learning memory
~~~

## The nine modules

| # | Module | Responsibility |
|---|---|---|
| 01 | [Feedback Collector](feedback_collector/) | Validates and normalizes source records while preserving identities |
| 02 | [Sentiment Analyzer](sentiment_analyzer/) | Adds explainable sentiment, confidence and review flags |
| 03 | [Topic Modeler](topic_modeler/) | Discovers themes and retains document-to-topic links |
| 04 | [Feature Request Detector](feature_request_detector/) | Detects requests, bugs and intent evidence |
| 05 | [Voice-of-Customer Dashboard](voice_of_customer_dashboard/) | Summarizes trends, segments and source evidence |
| 06 | [Prioritization Engine](prioritization_engine/) | Ranks explicitly reviewed opportunities against capacity and dependencies |
| 07 | [Experiment & Learning Workspace](experiment-data-quality-auditor/) | Persists runs, locks plans, audits events and records decisions |
| 08 | [Product Outcome Monitor](product_outcome_monitor/) | Detects whether expected outcomes persist and flags reversals or guardrail breaches |
| 09 | [Product Learning Memory](product_learning_memory/) | Retrieves prior decisions, evidence and monitored outcomes across workflow runs |

These are implementation-level connections. Project 7 imports the actual functions from Projects 1–6, invokes Project 8 for persisted outcome reviews, and invokes Project 9 across saved runs for evidence-backed learning retrieval.

## End-to-end workflow

1. Upload feedback with source IDs and timestamps.
2. Run normalization, sentiment, topic and request analysis.
3. Inspect the generated Voice-of-Customer evidence.
4. Review suggested opportunities and enter product estimates.
5. Rank reviewed opportunities within capacity.
6. Create an experiment tied to its opportunity and evidence.
7. Lock the plan before prospective exposure begins.
8. Audit exposure and conversion events.
9. Record an analyst-reviewed human decision.
10. Submit baseline and post-decision metric observations for outcome monitoring.
11. Review persistence, reversal and guardrail signals with the decision and originating feedback still attached.
12. Search the resulting learning before committing to a similar opportunity or experiment.

## Evidence lineage

~~~text
feedback ID
  → sentiment and intent evidence
  → topic
  → opportunity
  → priority decision
  → experiment
  → readout
  → reviewed decision
  → monitored outcome
  → searchable learning card
~~~

Clients cannot replace server-owned evidence links during prioritization. Experiments retain an opportunity snapshot so later reprioritization does not rewrite the original rationale.

## Human decision gates

- Opportunity scoring requires explicit PM review.
- Business value, user value, effort, risk and strategic alignment are supplied estimates.
- Prospective plans must be locked before exposure begins.
- Retrospective analyses cannot authorize shipping.
- Event defects block aggregate release.
- Shipping requires a clean latest audit, mature observation window, planned samples, completed guardrail reviews, analyst review and a named reviewer.

Counts and rate differences are descriptive. ProdMind does not claim statistical significance, causality or automatic shipping.

## Run all tests

Requirements: Node.js 22.13 or later.

~~~bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind
node experiment-data-quality-auditor/scripts/test-all.mjs
~~~

The root runner tests all nine JavaScript modules, including the evidence-to-memory lifecycle, real SQLite migrations, authenticated HTTP routes, persistence, stale-write protection, evidence lineage, decision gates, post-decision outcome signals and cross-run retrieval.

Optional Python ML research folders are not included in the root JavaScript runner.

## Run one module

Each project retains its own examples, schemas, tests, Worker and documentation:

~~~bash
cd feedback_collector
npm test
~~~

Standalone databases remain independent. The connected workspace does not silently read or migrate them. Existing feedback must be exported through the documented integration boundary.

## Deploy the connected workspace

~~~bash
cd experiment-data-quality-auditor
npx wrangler d1 create prodmind-workflow
~~~

Replace the placeholder database ID in wrangler.jsonc, then:

~~~bash
npx wrangler d1 migrations apply prodmind-workflow --remote
npx wrangler secret put API_TOKEN
npx wrangler deploy
~~~

The Worker serves the responsive interface and authenticated API. Workflow state is stored in D1 rather than browser storage.

## Security boundaries

- API access fails closed without the token or database binding.
- Mutations require the latest workflow revision.
- Conditional updates prevent stale overwrites.
- Raw experiment user IDs are audited but excluded from reports.
- Feedback text and supplied identifiers are persisted; use pseudonymous data.
- One deployment represents one trusted team. A shared token is not tenant isolation.
- Configure abuse protection before broad public exposure.

## Current limits

| Area | Limit |
|---|---|
| Feedback | 100 records per run |
| Feedback text | 4,000 characters per record |
| Experiments | 20 per run |
| Readouts | 20 per experiment |
| Event snapshot | 10,000 events and 2 MB |
| Persisted run | 900 KB |
| Experiment window | 1–90 days |
| Outcome model | Two variants and binary conversion |
| Product memory | 20 recent runs per connected query; 20 results returned |

No paid model or external inference service is required for the tested workflow. Cloudflare quotas still apply.

## Roadmap planning companion

The standalone [AI Roadmap Optimizer](https://github.com/MadanMohan0537/ai-roadmap-optimizer) continues the lifecycle after prioritization. It compares five delivery strategies while enforcing capacity, dependencies, commitments and deadlines.

The current handoff is explicit rather than automatically synchronized. A future adapter can preserve opportunity and evidence IDs without silently mutating either product.

## Repository structure

~~~text
.
├── feedback_collector/
├── sentiment_analyzer/
├── topic_modeler/
├── feature_request_detector/
├── voice_of_customer_dashboard/
├── prioritization_engine/
├── experiment-data-quality-auditor/
├── product_outcome_monitor/
├── product_learning_memory/
├── .github/             Repository-wide verification
├── .gitignore
├── LICENSE
└── README.md
~~~

## Documentation

- [Connected contracts, architecture and limits](experiment-data-quality-auditor/docs/CONNECTED_WORKFLOW.md)
- [Experiment workspace requirements](experiment-data-quality-auditor/docs/PRD.md)
- Individual architecture and usage guides inside every module

## Product principles

- Preserve evidence before generating recommendations.
- Keep scoring inputs and assumptions visible.
- Use deterministic code for validation and statistics-sensitive gates.
- Require human review for business estimates and consequential decisions.
- Fail closed when data quality is insufficient.
- Claim only what the code and tests support.

## License

The original modules use [Apache License 2.0](LICENSE), except where a component provides its own license. Projects 7 and 8 include their own MIT licenses. Imported modules retain their original notices.
