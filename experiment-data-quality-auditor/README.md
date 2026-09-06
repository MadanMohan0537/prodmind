# Project 7: Experiment & Learning Workspace

A connected workspace for ProdMind's feedback-to-decision lifecycle. It now composes projects 1–6 and preserves their evidence links, rather than operating only as a separate event validator.

**Repository path stays `experiment-data-quality-auditor/`. No second project 7 folder is needed.** The original auditor and CLI remain available within this project.

## What you can do

- Upload feedback and run the actual Collector, Sentiment Analyzer, Topic Modeler and Request Detector implementations.
- Inspect a Voice-of-Customer dashboard built from those same enriched records.
- Review topic-derived opportunities, enter your own estimates and rank them with project 6.
- Select an opportunity from the capacity portfolio and create an experiment tied to its source evidence.
- Lock a prospective plan before exposure; label historical analyses as retrospective.
- Audit raw exposure/conversion snapshots for duplicate IDs, variant crossover, missing exposure, invalid timestamps and window violations.
- Record a human decision after the audit, sample, duration and guardrail gates pass.
- Reopen the saved run and trace the decision back to the opportunity and original customer records.

## Interface and persistence

The light/dark responsive interface is served by `src/product-worker.js`. It calls real server APIs and uses D1 for authoritative state. The API token is kept only in the open page's memory, never in localStorage or uploaded content. Reloading requires re-entering it.

One installation serves one trusted team. All authenticated users share access; names entered as reviewers are user-supplied attribution, not verified identities. Keep production secrets and customer data out of Git.

## Run tests

From the repository root:

```bash
node experiment-data-quality-auditor/scripts/test-all.mjs
```

Or run only project 7:

```bash
cd experiment-data-quality-auditor
node --test
```

Node 22.13+ is required. Tests use Node's real SQLite engine behind the D1 query interface, including migrations, revision history, conflict detection and a complete HTTP lifecycle. They do not substitute for live Cloudflare or browser verification.

## Cloudflare deployment

From this project folder, with Wrangler installed or available through npx:

```bash
npx wrangler d1 create prodmind-workflow
```

Copy the returned database ID into the `database_id` placeholder in `wrangler.jsonc`. Do not reuse an existing module's database: this migration creates the connected workspace's own tables.

```bash
npx wrangler d1 migrations apply prodmind-workflow --local
npx wrangler secret put API_TOKEN
npx wrangler d1 migrations apply prodmind-workflow --remote
npx wrangler deploy
```

Use a high-entropy token, and configure access/abuse controls before exposing to untrusted users. The static interface is public but does not contain customer records; all data endpoints require authorization. Without D1 or the token the API fails closed. The existing six modules do not need separate deployments for the integrated path: their implementation modules are bundled by Wrangler.

For local development, put `API_TOKEN=<your-local-token>` in the ignored `.dev.vars`, apply the local migration, then use `npx wrangler dev`.

No hosted deployment has been verified as part of this change. Free-tier CPU, storage and request quotas apply; the connected ranking skips Monte Carlo to reduce computation. No model API is called.

## Start a run

Upload a JSON array, `{records:[...]}`, or Collector `{data:[...]}` export through the UI. Each source record needs a unique `id`, feedback text, and timestamp. Collector's `created_at` and serialized metadata are mapped at the server boundary. Use [the synthetic sample](public/sample-feedback.json) to try discovery without customer data.

All distinct source IDs are retained, even if their text matches. Similar-text groups are flagged for review. Records are not equivalent to unique affected customers. Topic labels, sentiment and request classifications are rule-based suggestions and need review.

The PM must fill every scoring factor, owner and rationale. No default business impact, effort or confidence is quietly inserted into the connected workflow. Dependents require assessed dependencies; cycles are rejected.

## API

Send `Authorization: Bearer <token>` and JSON for POST requests. All mutation requests after run creation require the latest integer `version`.

| Method | Path | Operation |
|---|---|---|
| GET | /api/health | Public configuration status |
| POST | /api/runs | Create and save discovery from title + records |
| GET | /api/runs | List latest 50 runs |
| GET | /api/runs/:run | Reload full saved workflow |
| POST | /api/runs/:run/rank | Save human assessments and capacity ranking |
| POST | /api/runs/:run/experiments | Create an evidence-linked draft |
| POST | /api/runs/:run/experiments/:id/start | Lock the plan |
| POST | /api/runs/:run/experiments/:id/readout | Audit and save a complete event snapshot |
| POST | /api/runs/:run/experiments/:id/decision | Record reviewed outcome against latest audit |
| GET | /api/runs/:run/learning | Return opportunity-linked decisions |
| POST | /api/audit | Original standalone, non-persistent event audit |

A stale version returns HTTP 409. Reload before resubmitting; writes are not automatically retried. This prevents lost updates and duplicate decisions. The SQLite revision journal is updated transactionally with each saved snapshot.

## Experiment contract

A draft requires `opportunityId`, hypothesis, distinct control/treatment descriptions, primary metric and conversion definition, owner, UTC start/end, an integer `minimumPerArm`, `sampleSizeRationale`, and guardrails with `name` and `criterion`. The UI captures one guardrail; the API accepts up to ten. The plan becomes immutable when started.

Readouts use the existing auditor envelope with `experiment_id` equal to the server-generated experiment ID and `events` containing `event_id`, `user_id`, `experiment_id`, `variant`, `type`, and `timestamp`. Variants are `control` or `treatment`; types are `exposure` or `conversion`. Event timestamps require exact UTC milliseconds, for example `2026-09-06T10:00:00.000Z`. Upload a full snapshot, not incremental batches. Partial-window snapshots can create false orphan findings.

A decision includes latest `auditId`, `outcome` (ship/iterate/reject), reviewer, rationale, analyst `statisticalReview`, and every guardrail's name, passed boolean and evidence. A clean audit, completed window and per-arm sample target are required for every terminal decision. Retrospective mode cannot record ship. Failed guardrails also prevent ship. There is no emergency-stop or cancellation endpoint in this version.

## Statistical boundary

Rates and their absolute difference are **descriptive only**. This workflow does not calculate sample size, statistical significance or SRM. The reviewer must supply those assessments and review stopping-rule validity separately. A sample target is a user-entered plan, not a claim of statistical power. The system records a human shipping decision; it never generates one automatically.

The separate AI Experimentation Copilot repository is not a live dependency. The meaningful connection implemented here is between the seven modules inside ProdMind.

## Original auditor CLI

```bash
node src/cli.js examples/clean.json
```

Exit 0: checks passed; exit 2: findings block aggregates; exit 1: invalid input/file. The fixture is deliberately tiny and demonstrates data handling, not experimental significance. Core audit functionality remains compatible.

## Source map

- `src/pipeline.js`: adapters and real imports for projects 1–6
- `src/lifecycle.js`: evidence-linked experiment and decision state machine
- `src/store.js`: persisted runs and optimistic concurrency
- `src/product-worker.js`: unified authenticated HTTP surface
- `src/audit.js`, `src/worker.js`, `src/cli.js`: original auditor interfaces
- `public/`: working interface and clearly labeled synthetic data
- `migrations/`: new D1 tables and transactional revision journal
- `tests/`: original audit tests plus integration, API and SQLite tests
- Repository-root `.github/workflows/experiment-data-quality-auditor.yml`: runs all seven modules

The redundant nested workflow template has been removed. [Shared architecture and limits](docs/CONNECTED_WORKFLOW.md) document what is and is not connected.

## Research and limitations

Experiment logging defects can undermine statistical interpretation; detecting a defect does not establish its root cause. See [Microsoft's data-quality discussion](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/data-quality-fundamental-building-blocks-for-trustworthy-a-b-testing-analysis) and [SRM taxonomy](https://www.microsoft.com/en-us/research/publication/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments-a-taxonomy-and-rules-of-thumb-for-practitioners/).

No live vendor connector, automatic legacy-database sync, event assignment, missing-source reconciliation, trained model, verified causal inference, multi-tenant permissions or unlimited free hosting is claimed. Raw experiment users are not saved in audit reports; source feedback is saved, so use pseudonymous data and define retention before real customer use.

## License

New project 7 code is [MIT](LICENSE). Imported original ProdMind modules remain Apache-2.0; retain the repository's root license when distributing the connected application.
