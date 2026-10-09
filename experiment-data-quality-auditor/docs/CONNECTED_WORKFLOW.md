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
| 14. Rebalance portfolio | `portfolio_rebalancing_simulator/src/rebalance.js` | Reviewable additions and removals linked to the saved ranking and original evidence |
| 40. Schedule roadmap | `roadmap_delivery_scheduler/src/scheduler.js` | Dated selected work linked to canonical portfolio items, teams, dependencies and original evidence |
| 15. Stress portfolio | `portfolio_resilience_stress_tester/src/stress.js` | Declared capacity, dependency and effort shocks linked to canonical portfolio items |
| 16. Realize benefits | `benefits_realization_tracker/src/benefits.js` | Expected and observed measures linked to selected work, decisions and original evidence |
| 17. Assure investment | `investment_assurance_review/src/assurance.js` | Post-implementation checks, named decision and corrective actions linked to benefits and evidence |
| 18. Test assumptions | `assumption_risk_register/src/assumptions.js` | Explicit product assumptions, authoritative evidence links and a validation queue |
| 19. Release safely | `release_readiness_controller/src/readiness.js` | Ship-decision, progressive rollout, monitoring and rollback readiness checks |
| 20. Measure adoption | `feature_adoption_analyzer/src/adoption.js` | Ordered journey, time-to-value and privacy-suppressed segment analysis |
| 21. Govern lifecycle | `product_lifecycle_planner/src/lifecycle.js` | Retain, invest, consolidate and retire plan safeguards |
| 22. Verify migration | `sunset_migration_monitor/src/monitor.js` | Aggregate cohort, dependency, notice, exception and zero-use reconciliation |
| 23. Verify outcomes | `sunset_outcome_monitor/src/outcomes.js` | Post-sunset customer harm, incidents, residual traffic, savings, reversibility and corrective-action checks |
| 24. Package provenance | `decision_provenance_pack/src/provenance.js` | Canonical artifact records, linked SHA-256 digests, approval separation, retention and certification checks |
| 25. Monitor governance | `governance_obligation_monitor/src/obligations.js` | Digest continuity, owned obligations, review cadence, certification freshness and retention action |
| 26. Govern exceptions | `governance_exception_register/src/exceptions.js` | Scoped targets, risk-based expiry, compensating controls, remediation links and independent approval |
| 27. Verify exception exits | `exception_exit_verifier/src/exits.js` | Follow-up target resolution, remediation completion, effectiveness evidence, observation and closure approval |
| 28. Monitor recurrence | `control_recurrence_monitor/src/recurrence.js` | Post-exit target stability, remediation durability, snapshot coverage and cadence |
| 29. Plan control improvements | `control_improvement_planner/src/planner.js` | Capacity-feasible recurrence response with dependencies, ownership and verification windows |
| 30. Verify improvement outcomes | `control_improvement_outcome_monitor/src/outcomes.js` | Delivery, effort, lineage, observation-window and later-recurrence assurance |

## Shared contracts

A discovery run has a server-generated UUID, revision, immutable source evidence and suggested opportunities. Source records require distinct IDs; a duplicate ID rejects the upload. Identical text from different source IDs stays in the evidence and appears as a duplicate-candidate group. This prevents text-only deduplication from silently erasing different customers. Evidence count means records, not unique affected customers.

Every opportunity holds `evidenceIds`. Clients may submit titles and estimates, but cannot replace these links. An experiment stores both the opportunity ID and its ranking snapshot so later reprioritization does not rewrite the experiment's original rationale. The learning endpoint returns decisions and outcome reviews linked back to that opportunity and its original records. Project 8 monitoring is submitted through `POST /api/runs/:runId/learning/:experimentId/monitor`; the server supplies the authoritative opportunity, experiment, decision and evidence identities. Learning does not silently change prioritization scores; PMs explicitly reassess and save a new ranking.

Opportunity IDs are scoped to a discovery run. Cross-run Projects 11–15 therefore expose `portfolioItemId` as `runId:opportunityId`. Research targets, strategy mappings, locks, dependencies, and scenario results use this canonical identity. Legacy opportunity-only mappings and locks are accepted only when the ID is unique across the selected runs; ambiguous requests fail explicitly.

The integrated ranking uses deterministic scores without Monte Carlo simulation to reduce request computation. Project 6's standalone simulation behavior is preserved by default. No synthetic uncertainty band is attached when simulation is disabled. Dependency cycles and missing assessed dependencies are rejected before invoking the portfolio selector.

Project 9 reads up to 20 recent versioned runs through `GET /api/memory`. Its weighted lexical search returns the matched fields and terms along with the decision, monitored status and source evidence. Retrieval never changes an opportunity, ranking, experiment or decision.

Project 10 reads the same bounded run history through `GET /api/calibration`. It treats `sustained` monitoring as a resolved success, `below_target` or `at_risk` as a resolved non-success, and keeps `emerging` or unmonitored decisions unresolved. It reports Brier score, confidence bias and fixed reliability bands while retaining run, opportunity, experiment, decision, monitor and evidence IDs. The result does not establish causality, alter scoring weights or evaluate individual team members.

Project 11 assesses recent run evidence through `GET /api/evidence-integrity`. It resolves server-owned opportunity evidence IDs, then reports age, sample size, source concentration, known-segment coverage and polarized sentiment. Findings never delete evidence or change rankings. Thresholds are visible product-policy defaults rather than statistical guarantees.

Project 12 calls Project 11 and then executes `planFromIntegrity` through `GET /api/research-plan?capacity=...`. The bounded exact solver maximizes unique severity-weighted finding coverage, enforces dependencies, and returns uncovered gaps. Automatically generated catalogs admit the 16 highest-severity actions and disclose any deferred actions. Scheduling a research action does not mark the underlying finding resolved.

Project 13 accepts a reviewed strategy through `POST /api/strategy-audit`, reads selected Project 6 opportunities from recent runs, and audits their effort allocation. Each selected opportunity maps to at most one primary objective, preventing duplicate effort attribution. The endpoint reports unmapped work, allocation-range exceptions, deviation, and concentration without modifying the strategy or ranking.

Project 14 accepts the same reviewed strategy plus capacity and optional locked portfolio-item IDs through `POST /api/portfolio-rebalance`. It searches up to 18 Project 6 candidates exactly, enforces declared dependencies, objective mappings, capacity and locked commitments, then lexicographically minimizes allocation-range violation and portfolio changes before maximizing score and utilization. The response is a scenario with retained evidence lineage; it does not mutate the saved ranking.

Project 40 accepts those same Project 14 inputs plus declared teams, calendars, delivery plans, deadlines, and a named review through `POST /api/roadmap-schedule`. Project 7 reconstructs the Project 14 scenario server-side, then evaluates every dependency-valid priority order for up to eight selected items. It minimizes missed deadlines, total lateness, and makespan while preserving original evidence IDs. It never changes the portfolio, assigns people, estimates duration, or commits delivery.

Project 15 accepts a reviewed strategy, capacity, optional Project 14 portfolio-item selection, and 1–12 declared stress scenarios through `POST /api/portfolio-stress`. It checks capacity loss, unavailable items, dependency failures, effort multipliers, and allocation drift while retaining evidence IDs. Scenario scores are transparent review indices, not probability forecasts, and the endpoint never changes a ranking.

Project 16 accepts 1–100 benefit profiles through `POST /api/benefits-realization`. It resolves each canonical portfolio item against selected Project 6 work, retains the experiment, decision, outcome-review and evidence IDs, and calculates increase or decrease progress against dated targets. It never adds incompatible units, infers causal attribution, or changes portfolio state.

Project 17 accepts benefit profiles and 1–100 named investment reviews through `POST /api/investment-assurance`. Project 7 first builds the Project 16 report from authoritative recent runs, then checks evidence, decision, benefit, measurement and attribution completeness. `continue`, `correct`, `close`, or `escalate` remains a human-supplied decision; corrective and escalation reviews require owned actions.

Project 18 accepts 1–200 assumption records through `POST /api/assumption-risk`. It validates each assumption against a selected canonical portfolio item and rejects evidence or experiment links outside that opportunity. Importance, uncertainty, owner, status, review date and validation method remain explicit inputs. Its exposure score orders unresolved validation work but is not a probability or automated decision.

Project 19 accepts Project 18 assumptions and 1–50 release plans through `POST /api/release-readiness`. Project 7 builds the authoritative assumption report, then checks for a reviewed `ship` decision, staged exposure, named monitors, rollback triggers, last-known-good version, ownership, compatibility, communications, and unresolved high-exposure assumptions. It never deploys or changes traffic.

Project 20 accepts the same upstream assumptions and releases plus 1–20 adoption journeys through `POST /api/feature-adoption`. Project 7 reconstructs the Project 18 and 19 reports, then calculates ordered step conversion, completion, median time-to-value, invalid users, and segment results. Segment metrics below the declared cohort threshold are omitted. The analysis is descriptive: it does not resolve identities, infer causality, or make product decisions.

Project 21 accepts Projects 18–20 inputs plus 1–50 lifecycle plans through `POST /api/product-lifecycle`. Project 7 reconstructs the authoritative upstream reports before checking a human-selected retain, invest, consolidate, or retire action. Consolidation and retirement require sufficient notice, a ready replacement, migration guidance, dependency plans, pre-sunset communications, exit criteria, and Product, Engineering, and Support approval. The engine never recommends or executes removal.

Project 22 accepts Projects 18–21 inputs plus 1–50 aggregate migration snapshots through `POST /api/sunset-migration`. Project 7 reconstructs every upstream report, then reconciles customer cohorts, dependency evidence, delivered notices, exceptions, sustained zero use, shutdown checks, and final cross-functional approval. An unresolved plan after its target date becomes `overdue_hold`; no result invokes a shutdown.

Project 23 accepts Projects 18–22 inputs plus 1–50 outcome reviews through `POST /api/sunset-outcomes`. Project 7 reconstructs all authoritative upstream reports before checking the observation window, support burden, incidents, residual traffic, observed-versus-expected savings, rollback evidence, corrective actions, and a named human decision. A human `close` choice is blocked when a check fails; `extend_monitoring` and `restore_service` remain action-required records. No result executes either choice.

Project 24 accepts Projects 18–23 inputs plus 1–50 governance-pack requests through `POST /api/governance-pack`. Project 7 reconstructs every upstream report, selects artifacts through server-owned IDs, canonicalizes their JSON, and creates a linked SHA-256 digest chain. Certification additionally requires artifact coverage, complete lineage, independent reviewers, Product, Engineering and Governance approval, fresh review timing, and classification-specific retention. The digests are integrity checks rather than signatures, and certification is not legal compliance.

Project 25 accepts Projects 18–24 inputs plus 1–50 governance monitors through `POST /api/governance-obligations`. Project 7 reconstructs the complete upstream chain and authoritative Project 24 digest before comparing the reviewed digest, checking 1–100 owned obligations, and calculating review, certification, and retention dates. Continue is blocked when controls fail; remediate, recertify, and dispose are recorded human actions, never executed by the Worker.

Project 26 accepts Projects 18–25 inputs plus 1–50 exception registers through `POST /api/governance-exceptions`. Project 7 reconstructs the complete upstream chain before verifying that each requested exception targets a real failure, expires within its risk-specific maximum, has evidenced compensating controls, links to an open remediation obligation, and has independent approvals. An active exception retains the Project 25 failure status; the endpoint grants no bypass and executes no remediation.

Project 27 accepts the Projects 18–26 baseline plus a later Project 25 monitor and 1–50 exit reviews through `POST /api/exception-exits`. Project 7 reconstructs both monitor snapshots before checking target resolution, completed evidenced remediation, explicit effectiveness tests, the observation window, residual risk, approval, and reviewer separation. A passing report is verification evidence; it does not mutate or close the exception.

Project 28 accepts the Project 27 exit chain plus 1–24 later Project 25 snapshots per surveillance review through `POST /api/control-recurrence`. Project 7 rebuilds the full baseline, exit, and follow-up reports before checking lineage, target stability, maintained remediation, snapshot coverage, and cadence. Keep-closed is blocked by recurrence or evidence gaps; reopen and escalate remain named human actions.

Project 29 accepts the same authoritative chain plus declared improvement candidates through `POST /api/control-improvements`. Project 7 rebuilds Project 28 server-side before deriving actionable targets. An exact bounded optimizer maximizes unique recurrence-risk coverage within capacity while enforcing dependencies. Approval is blocked below the declared coverage threshold; control changes and work assignment remain external human actions.

Project 30 accepts the approved Project 29 inputs, delivery evidence, actual effort, and later Project 28 surveillance through `POST /api/control-improvement-outcomes`. Project 7 reconstructs both the original recurrence response and the later verification report. Close is blocked unless delivery, schedule, effort tolerance, lineage, follow-up coverage, verification duration, and recurrence checks pass; no task or control is changed automatically.

Project 31 accepts the Project 30 chain plus portfolio calibration thresholds through `POST /api/control-improvement-calibration`. Project 7 reconstructs Projects 18–30 before measuring effort bias, delivery reliability, observed effectiveness, recurrence, observation completeness, and evidence coverage. Accepting a baseline is blocked by insufficient evidence or a failed threshold. Signals are descriptive: no estimate is rewritten, no person is ranked, and causality is not inferred.

Project 32 accepts the Project 31 chain plus reversible planning-policy candidates through `POST /api/planning-policy-experiments`. Project 7 reconstructs Projects 18–31 before deriving targets from failed calibration checks. Exact bounded optimization maximizes unique weighted gap coverage within capacity and dependencies. Approval is blocked below the declared coverage threshold; no estimate, policy, assignment, or process is changed automatically.

Project 33 accepts the same connected chain plus completed trial observations through `POST /api/planning-policy-outcomes`. Project 7 reconstructs Projects 18–32 server-side, then checks each named human decision against the trial's predeclared primary measure, guardrail, sample size, timing, observation window, and evidence. A failed prerequisite blocks an `adopt` result; the system never claims causality or changes planning policy automatically.

Project 34 accepts the connected Project 33 chain, active policy baselines, and proposed changes through `POST /api/planning-policy-changes`. Project 7 reconstructs Projects 18–33 server-side before checking version advancement, bounded scope, progressive rollout, monitoring, rollback, enablement evidence, and independent approvals. It returns readiness evidence but never activates, distributes, or rolls back a policy.

Project 35 accepts the connected Project 34 chain and observed rollout snapshots through `POST /api/planning-policy-rollouts`. Project 7 reconstructs Projects 18–34 server-side before reconciling activation timing, stage sequence, minimum dwell, target version, monitor thresholds, and evidence. Continue, pause, and rollback remain named human decisions; the monitor never performs them.

Project 36 accepts the connected Project 35 chain and longitudinal effectiveness observations through `POST /api/planning-policy-effectiveness`. Project 7 reconstructs Projects 18–35 server-side, resolves each rollout back to its Project 32 predeclared measures through Project 33, and checks sustainment window, observation cadence, version continuity, sample size, primary target, guardrail, evidence, and drift. Retain, adjust, and revert remain named human decisions; the monitor never performs them or claims causality.

Project 37 accepts the Project 36 revert path plus ordered execution and recovery evidence through `POST /api/planning-policy-recovery`. Project 7 reconstructs Projects 18–36 server-side, then verifies revert authorization, the Project 34 decision SLA and target version retained by Project 35, complete execution, recovery duration and cadence, every declared monitor threshold, evidence, and a named human close, continue, or escalate decision. The verifier never executes reversion, changes policy, closes an event, or claims the reversion caused recovery.

Project 38 accepts verified Project 37 recovery plus an evidence-backed incident learning review through `POST /api/planning-policy-reentry`. Project 7 reconstructs Projects 18–37 server-side before checking timely publication, system-focused contributing conditions, lessons, preventive and detective actions, critical-action completion, overdue work, cooling time, recovered baseline, bounded scope, safety acknowledgements, and independent approvals. Freeze continuation, re-entry, and escalation remain named human decisions; no result lifts a freeze, starts a trial, changes policy, assigns blame, or claims causality.

Project 39 accepts the complete Project 38 chain plus a pre-exposure declaration, bounded stage executions, and evidence-backed observations through `POST /api/planning-policy-reentry-assurance`. Project 7 reconstructs Projects 18–38 server-side before checking the approved owner, recovered baseline, scope, exposure ceiling, stage order and dwell, observation window, sample sufficiency, completed critical controls, incident recurrence signals, guardrails, and a named human continue, pause, or refreeze decision. It never changes policy, expands exposure, pauses or refreezes a trial, assigns blame, or claims causality.

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
