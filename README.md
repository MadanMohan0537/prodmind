# Product Evidence-to-Decision Suite

[![Connected lifecycle](https://github.com/MadanMohan0537/product-evidence-to-decision-suite/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/product-evidence-to-decision-suite/actions/workflows/experiment-data-quality-auditor.yml)

**Follow one piece of customer feedback all the way through a product decision: from a feedback record to a prioritized opportunity, a locked experiment plan, a human decision, outcome monitoring, and the review and governance steps after launch, without losing the evidence trail.**

Previously named *ProdMind*. Cloudflare Worker names that use the `prodmind-` prefix, and package names that use `prodmind-` or `@prodmind/`, stay as they are. Three package names do not use that prefix: `experiment-data-quality-auditor`, `feedback-collector`, and `product-outcome-monitor`. The feedback collector's Worker name is `feedback-collector`.

## Start here (one-screen overview)

- **What it is:** 51 small, single-purpose product-management tools (JavaScript, Cloudflare Workers + D1) plus one **connected workspace** that strings them together. Every opportunity, experiment, and decision keeps the IDs of the feedback records that justified it.
- **Where to look first:** the connected workspace in [`experiment-data-quality-auditor/`](experiment-data-quality-auditor/README.md), called "Project 7" in that module's docs. The folder keeps its original name because the experiment data-quality audit is its core component.
- **What to run first:** the full test suite and the audit demo (see Quick start).
- **The headline story:** *evidence before decisions*. A recommendation can only move forward when the feedback, experiment data, and human review behind it are recorded and checkable.

## Problem and who it's for

Product teams collect feedback in one tool, prioritize in a spreadsheet, run experiments somewhere else, and rarely check afterward whether a decision delivered what it promised. By the time someone asks "why did we build this?", the evidence is scattered. This is for product managers, product ops, and the program or governance leads who have to show how a decision was made.

## Approach

The suite is organized as a lifecycle. Each module solves one bounded problem and passes evidence IDs to the next:

| Stage | Modules (project numbers) | Examples of what they do |
|---|---|---|
| Evidence | 1–5, 11, 18 | Normalize feedback, explainable sentiment, topics, feature-request detection, a Voice-of-Customer dashboard, evidence-integrity checks, an assumption register |
| Prioritization and portfolio | 6, 12–15 | Transparent scoring against capacity and dependencies, research planning, strategy alignment, rebalancing, and stress-test scenarios |
| Experiments and release | 7, 19 | Locked experiment plans, event-data quality audits, human decisions, release-readiness and rollback checks |
| Learning and value | 8–10, 16–17, 20–23 | Outcome monitoring, searchable decision history, forecast calibration (Brier score), benefits realization, adoption funnels, sunset and migration checks |
| Governance | 24–39 | SHA-256 provenance packs, obligation monitoring, time-bound exceptions, corrective-action verification, controlled policy changes |
| Delivery and estimation | 40–51 | Roadmap scheduling, baseline-vs-actual monitoring, recovery planning, estimate calibration, and controlled recalibration |

Design rules that hold across the Workers: deterministic, explainable logic in the Worker path; humans make every decision, and the tools check whether the declared evidence and controls are present; the tools record their own review state and do not apply product, policy, schedule, or delivery changes.

## What exists today

Checked against this repository (51 module folders, each with `src/`, a `public/` frontend, tests, and a `wrangler.jsonc`):

- The connected workspace imports the other 50 modules. Its Worker name is `prodmind-connected-workflow`, entry `src/product-worker.js`.
- `node experiment-data-quality-auditor/scripts/test-all.mjs` ran **840 tests across all 51 modules, with no failures**, on Node.js v22.23.3. Node.js 22.13 or later is what the connected workspace documents, what several module `engines` fields set, and what GitHub Actions installs (Node.js 22).
- The workflow [ProdMind connected lifecycle](.github/workflows/experiment-data-quality-auditor.yml) runs that suite. Its latest run on `main` succeeded.
- The connected workspace stores versioned runs in D1 (`prodmind-workflow`, binding `DB`), requires a bearer token (`API_TOKEN`), rejects cross-origin API requests, and rejects stale writes (HTTP 409).
- **None of the Workers are live.** This README does not link a demo.

## How success would be measured

| Measure | Status |
|---|---|
| Share of decisions with complete evidence links | The workspace enforces links; not yet measured with a real team |
| Data-quality failures caught before an experiment readout | Covered by tests on fixtures; not yet measured in use |
| PM time to assemble a decision record, with review quality kept | Not yet measured |
| Outcomes monitored after launch vs. decisions made | Not yet measured |

None of these should reward automatic shipping or unsupported causal claims.

## Limitations

- **Scope is very broad for a portfolio project.** 51 modules is a lot to review, so start with the connected workspace and treat the other modules as reference implementations.
- The Workers use deterministic baselines for sentiment, topics, and request detection. Optional Python research pipelines live in `sentiment_analyzer/ml/` and `topic_modeler/ml/`. They are separate from the Workers, and no trained production model is claimed.
- Experiment readouts are descriptive (data-quality audit and rates). There is no automatic significance or causal claim.
- Authentication is a shared bearer token for one trusted team, not multi-tenant isolation.
- The feedback collector includes connector utilities and an hourly Cron Trigger for a configured Zendesk sync. The other connector shapes in that module are mapping utilities and have no scheduled sync.
- Licensing is mixed. The root is Apache-2.0. 37 module folders carry their own MIT `LICENSE`, 8 carry Apache-2.0, and 6 have no module `LICENSE` (their READMEs point at the root Apache-2.0 file).

## Quick start

Use Node.js 22.13 or later. The commands below need no paid API.

```bash
git clone https://github.com/MadanMohan0537/product-evidence-to-decision-suite.git
cd product-evidence-to-decision-suite
node experiment-data-quality-auditor/scripts/test-all.mjs     # 840 tests, all 51 modules

cd experiment-data-quality-auditor
npm test                                                      # this folder's node --test
npm run demo                                                  # audits examples/clean.json
```

`npm test` is `node --test`. That pattern also matches `scripts/test-all.mjs`, and Node then skips nested suite runs. The 840 count is from the direct `test-all.mjs` command above.

Run one standalone module (the feedback collector):

```bash
cd feedback_collector
npm install
npm run check
```

## Deployment

Nothing here is deployed. Deploy to your own Cloudflare account with Wrangler, using `npx wrangler deploy` to publish the current Worker script. Keep each Worker name as it is written in that folder's `wrangler.jsonc`.

Connected workspace, from `experiment-data-quality-auditor/wrangler.jsonc`:

| | |
|---|---|
| Worker name | `prodmind-connected-workflow` |
| Entry point | `src/product-worker.js` |
| Asset binding | `ASSETS` (`./public`) |
| D1 binding | `DB`, database name `prodmind-workflow`, migrations in `migrations/` |
| Secret | `API_TOKEN` (the API returns 503 until this is set) |

`database_id` is still the placeholder `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

```bash
cd experiment-data-quality-auditor
npx wrangler d1 create prodmind-workflow
# copy the returned database ID into wrangler.jsonc
npx wrangler d1 migrations apply prodmind-workflow --remote
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Each of the other 50 modules has its own `wrangler.jsonc`. From that module's directory, run `npx wrangler deploy` and leave the `name` field unchanged. Bindings differ by module. The feedback collector's Worker name is `feedback-collector`, its entry point is `src/worker.js`, and its config binds `ASSETS`, D1 database `feedback-collector-db` (`DB`), and queue `INGESTION_QUEUE`, with an hourly cron. Set `API_TOKEN` the same way before using its protected routes.

## Related repositories

- [ai-product-discovery-engine](https://github.com/MadanMohan0537/ai-product-discovery-engine): a smaller, single-purpose discovery tool. Its README documents a local run (`npm run dev` on port 8787) and a Cloudflare Worker deploy.
- [feedback-prioritizer](https://github.com/MadanMohan0537/feedback-prioritizer): a Python/Streamlit feedback collector and prioritizer whose README describes vendor connector adapters.

## License

Apache-2.0 at the root (see [LICENSE](LICENSE)). Some module folders include their own MIT or Apache-2.0 license file.
