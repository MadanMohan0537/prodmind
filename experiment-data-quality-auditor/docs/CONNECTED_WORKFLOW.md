# ProdMind connected workflow

## What is connected

The project 7 Worker calls the existing implementations of projects 1–6 directly inside one server request. These are real imports, not links to separate demos and not copies of their algorithms. A saved workflow run is the source of truth for this connected path.

| Stage | Implementation reused | Persisted connection |
|---|---|---|
| 1. Collect | `feedback_collector/src/worker.js::prepareRecord` | Original source ID, normalized text, timestamp, source and fingerprint |
| 2. Sentiment | `sentiment_analyzer/public/analyzer.js::analyzeSentiment` | Sentiment, rules evidence and review flags on that same record |
| 3. Topics | `topic_modeler/public/topic-modeler.js::modelTopics` | Document ID joins to topic ID |
| 4. Requests | `feature_request_detector/public/detector.js::detectIntents` | Intents and their evidence on that same record |
| 5. Dashboard | `voice_of_customer_dashboard/public/analytics.js::buildDashboard` | Summary, segments, trends and source evidence from the enriched records |
| 6. Prioritize | `prioritization_engine/public/engine.js::prioritize` | Reviewed estimates plus server-owned opportunity/evidence IDs |
| 7. Experiment and learn | `experiment-data-quality-auditor/src/lifecycle.js` | Locked plan, opportunity snapshot, event audits and reviewed decision |
| 8. Monitor outcomes | `product_outcome_monitor/src/monitor.js` | Decision ID, evidence IDs, post-decision signals, guardrail breaches and persisted reviews |
| 9. Remember learning | `product_learning_memory/src/memory.js` | Cross-run decision cards with explainable retrieval and original evidence IDs |
| 10. Calibrate decisions | `decision_calibration_engine/src/calibration.js` | Confidence forecasts joined to resolved monitored outcomes with full identity lineage |
| 11. Verify evidence | `evidence_integrity_monitor/src/integrity.js` | Freshness, source, segment, sample-size and lineage findings for each opportunity |
| 12. Plan research | `research_portfolio_optimizer/src/optimizer.js` | Capacity-aware action selection linked to Project 11 findings and opportunities |
| 13. Align strategy | `strategy_alignment_auditor/src/alignment.js` | Selected opportunity effort mapped to declared strategic objectives and ranges |

## Shared contracts

A discovery run has a server-generated UUID, revision, immutable source evidence and suggested opportunities. Source records require distinct IDs; a duplicate ID rejects the upload. Identical text from different source IDs stays in the evidence and appears as a duplicate-candidate group. This prevents text-only deduplication from silently erasing different customers. Evidence count means records, not unique affected customers.

Every opportunity holds `evidenceIds`. Clients may submit titles and estimates, but cannot replace these links. An experiment stores both the opportunity ID and its ranking snapshot so later reprioritization does not rewrite the experiment's original rationale. The learning endpoint returns decisions and outcome reviews linked back to that opportunity and its original records. Project 8 monitoring is submitted through `POST /api/runs/:runId/learning/:experimentId/monitor`; the server supplies the authoritative opportunity, experiment, decision and evidence identities. Learning does not silently change prioritization scores; PMs explicitly reassess and save a new ranking.

The integrated ranking uses deterministic scores without Monte Carlo simulation to reduce request computation. Project 6's standalone simulation behavior is preserved by default. No synthetic uncertainty band is attached when simulation is disabled. Dependency cycles and missing assessed dependencies are rejected before invoking the portfolio selector.

Project 9 reads up to 20 recent versioned runs through `GET /api/memory`. Its weighted lexical search returns the matched fields and terms along with the decision, monitored status and source evidence. Retrieval never changes an opportunity, ranking, experiment or decision.

Project 10 reads the same bounded run history through `GET /api/calibration`. It treats `sustained` monitoring as a resolved success, `below_target` or `at_risk` as a resolved non-success, and keeps `emerging` or unmonitored decisions unresolved. It reports Brier score, confidence bias and fixed reliability bands while retaining run, opportunity, experiment, decision, monitor and evidence IDs. The result does not establish causality, alter scoring weights or evaluate individual team members.

Project 11 assesses recent run evidence through `GET /api/evidence-integrity`. It resolves server-owned opportunity evidence IDs, then reports age, sample size, source concentration, known-segment coverage and polarized sentiment. Findings never delete evidence or change rankings. Thresholds are visible product-policy defaults rather than statistical guarantees.

Project 12 calls Project 11 and then executes `planFromIntegrity` through `GET /api/research-plan?capacity=...`. The bounded exact solver maximizes unique severity-weighted finding coverage, enforces dependencies, and returns uncovered gaps. Automatically generated catalogs admit the 16 highest-severity actions and disclose any deferred actions. Scheduling a research action does not mark the underlying finding resolved.

Project 13 accepts a reviewed strategy through `POST /api/strategy-audit`, reads selected Project 6 opportunities from recent runs, and audits their effort allocation. Each selected opportunity maps to at most one primary objective, preventing duplicate effort attribution. The endpoint reports unmapped work, allocation-range exceptions, deviation, and concentration without modifying the strategy or ranking.

## Human gates

1. Review topic-generated opportunity labels, then enter business value, user value, strategic alignment, confidence, feasibility, urgency, effort, risk and uncertainty. These are PM estimates, not model-derived facts.
2. Select an opportunity within the capacity portfolio, write the hypothesis and metric definition, enter an analyst-supported sample target and guardrail criteria.
3. Lock a prospective plan before exposure begins. Historical reviews must be explicitly retrospective and cannot approve shipping.
4. Upload a complete event snapshot. Duplicate IDs, crossover, orphan conversions, time-order errors and observation-window violations block aggregate release.
5. A decision requires the latest clean audit, completed planned window, enough users in each arm, all guardrail reviews, an analyst review and a named reviewer. Failed guardrails block `ship`.

These are workflow gates, not statistical proof. Counts and rate differences are descriptive. No sample-size calculation, significance test or SRM inference is performed in this connected version; the analyst must review those separately. The independent Experimentation Copilot is not silently imported or claimed as integrated.

## Persistence and concurrency

`product_runs` stores a bounded JSON snapshot per run. D1's SQLite engine enforces JSON validity. Each update requires the previous revision and uses one conditional `UPDATE ... RETURNING`; a stale writer gets HTTP 409. SQL triggers append revision/stage journal rows in the same transaction as the write. The journal contains stage transitions, not full historical snapshots. Experiment plans, audits and decisions remain in the current snapshot.

Raw experiment user IDs are processed for validation but not persisted in readout reports. Feedback text and supplied customer identifiers are persisted; upload pseudonymous, non-sensitive records and apply your organization's retention rules. No account or tenant isolation is claimed: one installation is one trusted team with a shared token.

## Existing standalone projects

Their APIs and databases remain independent and available. The connected deployment does not migrate, read or modify their existing D1 databases. To use already collected feedback, export JSON and upload it into the connected workspace. Arrays, `{records:[...]}`, and Collector `{data:[...]}` exports are accepted by the UI. `created_at`, `createdAt` and `timestamp` are mapped at the integration boundary. Records still require IDs and dates. Automatic cross-database synchronization is not implemented.

## Limits

- 100 feedback records per run, 4,000 characters per record
- 20 experiments per run, 20 readouts and 20 outcome reviews per experiment
- 10,000 raw events per snapshot and 2 MB request limit
- 900 KB persisted run limit; rejected updates do not overwrite saved work
- 50 most recent runs listed; known IDs remain directly retrievable
- Two variants, user-level binary outcomes, one conversion definition
- 1–90 day planned window; dates in the UI are UTC
- No scheduled collection, traffic assignment, notifications, automatic result inference or automatic shipping

Cloudflare free-tier resource limits can still constrain large inputs. Disabling simulation reduces computation; it does not guarantee every maximum-size request fits every provider limit. No paid model or external service is required for local tests.

## Runtime references

- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [D1 transaction behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Worker static asset routing](https://developers.cloudflare.com/workers/static-assets/)
