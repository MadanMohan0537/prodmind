# ProdMind

Seven focused product-management modules, now connected through one evidence-to-learning workflow.

ProdMind helps a product team move from customer feedback to reviewed opportunities, capacity-aware priorities, experiments and recorded decisions. The modules remain independently runnable; project 7 now provides their shared workspace and persistence.

## Start with the connected workspace

The entry point is [Experiment & Learning Workspace](experiment-data-quality-auditor/). Its existing folder name is retained to avoid breaking links. The original event auditor is now a supporting component rather than a disconnected product.

1. Upload feedback with source IDs and dates.
2. Inspect sentiment, topics, intents and the evidence dashboard.
3. Review candidates and supply your business/effort estimates.
4. Rank assessed opportunities within capacity.
5. Create and lock an evidence-linked experiment plan.
6. Audit a complete event snapshot against the plan.
7. Record a human-reviewed decision and revisit the originating opportunity.

## Modules

| # | Project | Connection in the shared workflow |
|---|---|---|
| 01 | [Feedback Collector](feedback_collector/) | Normalizes and validates the source records |
| 02 | [Sentiment Analyzer](sentiment_analyzer/) | Enriches those same records with sentiment evidence |
| 03 | [Topic Modeler](topic_modeler/) | Assigns themes while retaining document IDs |
| 04 | [Feature Request Detector](feature_request_detector/) | Attaches requests, intents and review flags |
| 05 | [Voice-of-Customer Dashboard](voice_of_customer_dashboard/) | Summarizes the enriched evidence |
| 06 | [Prioritization Engine](prioritization_engine/) | Ranks human-assessed, evidence-linked opportunities |
| 07 | [Experiment & Learning Workspace](experiment-data-quality-auditor/) | Persists the workflow, locks plans, audits events and records linked decisions |

These connections are implemented as imports of the original module functions, with integration tests checking the joins. They are not just navigation links. Existing standalone D1 databases are not automatically synchronized or migrated; export existing feedback into the connected workspace when needed.

## Local verification

Node.js 22.13 or later is required for the integration tests' built-in SQLite support. No package installation or paid API is needed:

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind
node scripts/test-all.mjs
```

The runner tests all seven JavaScript modules, including the complete HTTP workflow and real SQLite persistence. Optional Python ML extras in the original projects are not covered by this runner.

## Deployment

Use the [project 7 deployment instructions](experiment-data-quality-auditor/README.md#cloudflare-deployment) for one Cloudflare Worker serving the shared interface and API. It requires one D1 database and a server-side API token. Existing project deployments are unchanged. No deployment or data migration happens merely by cloning or merging this code.

## Product boundaries

- Business estimates and experiment decisions require human review.
- The connected version uses deterministic rules/clustering and lightweight ranking, not a paid LLM.
- The experiment auditor validates events; it does not calculate statistical significance or prove causality.
- One installation is one trusted team. Shared-token access is not multi-tenant authorization.
- Feedback and workflow state are saved in D1, not browser storage.
- Cloudflare quotas still apply; free software does not promise unlimited free hosting.

See [the shared contracts, architecture and limits](docs/CONNECTED_WORKFLOW.md).

## License

[Apache-2.0](LICENSE) for the original modules, except where a component provides its own license. New project 7 code is [MIT-licensed](experiment-data-quality-auditor/LICENSE); imported Apache-2.0 modules retain their notices and license.

