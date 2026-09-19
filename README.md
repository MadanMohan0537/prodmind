<div align="center">

# ProdMind

**A twenty-one-project, evidence-to-lifecycle operating system for product teams.**

[![Connected lifecycle](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](LICENSE)

</div>

ProdMind connects customer evidence, product judgment, experimentation, outcome monitoring, and institutional learning in one traceable workflow. Each project solves one bounded problem; the Project 7 workspace composes their real implementations and preserves the same evidence identities from ingestion through retrieval.

No paid model or software service is required for the tested workflow. The connected application is designed for Cloudflare Workers and D1.

## Product lifecycle

```text
Customer feedback
      ↓
1. Normalize and validate
      ↓
2–4. Sentiment, topics and request intent
      ↓
5. Voice-of-Customer evidence
      ↓
6. Human-reviewed prioritization
      ↓
7. Experiment plan, audit and decision
      ↓
8. Post-decision outcome monitoring
      ↓
9. Searchable product learning memory
      ↓
10. Decision-confidence calibration
      ↺
11. Evidence-integrity monitoring
      ↓
12. Capacity-aware research planning
      ↓
13. Strategic portfolio alignment
      ↓
14. Minimum-disruption portfolio rebalancing
      ↓
15. Declared-scenario portfolio resilience testing
      ↓
16. Expected-versus-observed benefits realization
      ↓
17. Post-implementation investment assurance
      ↺
18. Explicit assumption validation
      ↓
19. Progressive release and rollback readiness
      ↓
20. Feature adoption journey measurement
      ↓
21. Govern retention, investment, consolidation or retirement
```

## Portfolio impact model

ProdMind is designed around decisions rather than disconnected demos:

| Decision layer | Projects | Intended impact |
|---|---|---|
| Evidence readiness | 1–5, 11, 18 | Trustworthy customer signals and explicit assumptions |
| Portfolio judgment | 6, 12–15 | Explicit trade-offs across product, research, strategy and resilience |
| Experiment and release governance | 7, 19 | Prospective plans, reviewed decisions, staged release and rollback readiness |
| Learning, value and lifecycle | 8–10, 16–17, 20–21 | Monitored outcomes, reusable context, realized benefits, adoption and responsible lifecycle decisions |

The product should be evaluated by evidence-linked decisions, time saved with review quality preserved, prevented data-quality failures, accepted research plans, monitored outcome coverage, and strategy exceptions resolved. None of these measures should reward automatic shipping or unsupported causal claims.

## The twenty-one projects

| # | Project | What it contributes | Frontend |
|---:|---|---|---|
| 1 | [Feedback Collector](feedback_collector/) | Validated, normalized and deduplicated feedback | Manual entry, CSV/JSON import, saved records and export |
| 2 | [Sentiment Analyzer](sentiment_analyzer/) | Explainable sentiment, aspects and review flags | Text/batch analysis with visible evidence |
| 3 | [Topic Modeler](topic_modeler/) | Topic assignments, keywords, hierarchy and drift | Topic exploration and assignment inspection |
| 4 | [Feature Request Detector](feature_request_detector/) | Multi-label product intent and evidence sentences | Request, bug, complaint and churn-signal inspection |
| 5 | [Voice-of-Customer Dashboard](voice_of_customer_dashboard/) | Trends, filters, segments and source evidence | Interactive light/dark dashboard |
| 6 | [Prioritization Engine](prioritization_engine/) | Transparent scores and capacity-aware portfolio | Weights, rankings, Pareto and dependency views |
| 7 | [Experiment & Learning Workspace](experiment-data-quality-auditor/) | Connected lifecycle, D1 state, audit and human decisions | Primary twenty-one-stage ProdMind workspace |
| 8 | [Product Outcome Monitor](product_outcome_monitor/) | Persistence, reversal and guardrail monitoring | Standalone and Project 7 monitoring interfaces |
| 9 | [Product Learning Memory](product_learning_memory/) | Cross-run retrieval of evidence-linked learning | Standalone and connected search interfaces |
| 10 | [Product Decision Calibration Engine](decision_calibration_engine/) | Brier scores and reliability bands for resolved product forecasts | Standalone and connected calibration views |
| 11 | [Product Evidence Integrity Monitor](evidence_integrity_monitor/) | Freshness, coverage, concentration and lineage checks | Standalone and connected integrity views |
| 12 | [Product Research Portfolio Optimizer](research_portfolio_optimizer/) | Exact capacity-aware selection of evidence-gap research | Standalone and connected planning views |
| 13 | [Product Strategy Alignment Auditor](strategy_alignment_auditor/) | Effort allocation against declared strategic objectives | Standalone and connected portfolio audits |
| 14 | [Strategic Portfolio Rebalancing Simulator](portfolio_rebalancing_simulator/) | Minimum-disruption capacity, dependency and strategy scenarios | Standalone and connected scenario review |
| 15 | [Product Portfolio Resilience Stress Tester](portfolio_resilience_stress_tester/) | Declared capacity, dependency and effort shocks | Standalone and connected resilience review |
| 16 | [Product Benefits Realization Tracker](benefits_realization_tracker/) | Expected-versus-observed benefits with complete evidence lineage | Standalone and connected realization ledger |
| 17 | [Product Investment Assurance Review](investment_assurance_review/) | Post-implementation completeness, named decisions and corrective actions | Standalone and connected assurance review |
| 18 | [Product Assumption Risk Register](assumption_risk_register/) | Explicit assumptions, authoritative links and validation urgency | Standalone and connected assumption review |
| 19 | [Product Release Readiness & Rollback Controller](release_readiness_controller/) | Progressive exposure, observable triggers and reversible delivery | Standalone and connected release gate |
| 20 | [Feature Adoption Journey Analyzer](feature_adoption_analyzer/) | Ordered adoption, time-to-value and privacy-safe segment analysis | Standalone and connected adoption view |
| 21 | [Product Lifecycle & Deprecation Planner](product_lifecycle_planner/) | Migration, notice, dependency and approval safeguards for lifecycle decisions | Standalone and connected lifecycle gate |

`.github/` is supporting CI configuration, not a product project.

## What is genuinely connected

Project 7 imports and executes the shared implementation functions from Projects 1–6. It also imports the engines behind Projects 8–21 for monitoring, memory, portfolio governance, benefits realization, assurance, assumption validation, release readiness, adoption measurement, and lifecycle governance. The connected deployment therefore provides an executable product path—not a collection of README links.

Identity lineage:

```text
feedbackId → topicId → runId:opportunityId → experimentId
           → auditId → decisionId → monitorId
           → benefitId
           → assuranceReviewId → actionId
           ↺ assumptionId → evidenceId / experimentId
           → releaseId → monitor / rollback trigger
           → journeyId → ordered stage observations
           → lifecyclePlanId → dependencies / notices / approvals
```

Every opportunity and experiment retains `evidenceIds`. Within a run, `opportunityId` is stable; cross-run portfolio work uses `portfolioItemId` (`runId:opportunityId`) so same-named opportunities never collide. Client-provided IDs cannot replace server-owned links during prioritization or outcome monitoring.

## Primary frontend

The deployable interface in `experiment-data-quality-auditor/public/` supports:

1. Loading and creating D1-backed discovery runs.
2. Uploading normalized feedback JSON.
3. Inspecting Projects 2–5 evidence.
4. Entering explicit opportunity assessments.
5. Saving Project 6 rankings and portfolio selections.
6. Creating and locking experiment plans.
7. Auditing event snapshots and recording reviewed decisions.
8. Uploading Project 8 monitoring snapshots.
9. Searching Project 9 learning across saved runs.
10. Reviewing Project 10 portfolio calibration against resolved outcomes.
11. Reviewing Project 11 integrity findings against original evidence IDs.
12. Optimizing Project 12 research actions within available capacity.
13. Auditing Project 13 selected effort against declared strategic objectives.
14. Simulating Project 14’s smallest feasible portfolio change without overwriting the saved ranking.
15. Stress-testing Project 15 portfolios against declared capacity, dependency and effort scenarios.
16. Comparing Project 16 benefit targets with observed measures and original decision evidence.
17. Recording Project 17 post-implementation assurance decisions and accountable corrective actions.
18. Registering Project 18 assumptions and ordering evidence-linked validation work.
19. Verifying Project 19 progressive rollout, monitoring and rollback readiness.
20. Measuring Project 20 ordered adoption, time-to-value, and privacy-suppressed segments.
21. Validating Project 21 retain, invest, consolidate, and retire safeguards.

All project frontends use system-aware light and dark color schemes. Standalone interfaces are useful for focused demonstrations; Project 7 is the integrated product.

## Run the complete test suite

Node.js 22.13 or later is recommended.

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind
node experiment-data-quality-auditor/scripts/test-all.mjs
```

The suite covers all twenty-one projects, shared contracts, authenticated routes, real SQLite migrations, evidence lineage, decision gates, portfolio governance, benefits realization, assurance, assumption validation, release readiness, adoption measurement, and lifecycle safeguards.

Run one project independently:

```bash
cd feedback_collector
npm install
npm run check
```

## Deploy the connected product

```bash
cd experiment-data-quality-auditor
npx wrangler d1 create prodmind-workflow
# copy the returned database ID into wrangler.jsonc
npx wrangler d1 migrations apply prodmind-workflow --remote
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Projects 1–6 and 8–21 are bundled into the connected Worker through imports. Their standalone deployments remain independent and are not silently synchronized.

## Security and decision boundaries

- Connected API access fails closed without D1 and `API_TOKEN`.
- Mutations require the latest workflow version.
- Cross-origin API requests are rejected.
- Raw experiment user IDs are excluded from persisted audit reports.
- Feedback content and customer identifiers may be sensitive; use pseudonymous data.
- Classifier confidence is not business value.
- Counts and rate differences are not statistical or causal proof.
- Outcome signals do not automatically approve rollout changes.
- Historical search results do not automatically change priorities.
- Calibration results describe a portfolio and do not evaluate individual employees.
- Evidence-integrity scores are review heuristics, not representativeness guarantees.
- Research optimization covers declared findings; it does not prove that a study will resolve them.
- Strategy allocation describes selected effort; it does not measure realized benefits.
- Rebalancing produces a reviewable scenario; it never applies ranking or roadmap changes.
- Resilience scores evaluate declared scenarios; they are not likelihood forecasts and never change the portfolio.
- Benefit progress compares declared targets and observations; it does not prove causality or combine unlike units.
- Investment assurance records a human decision; completeness checks never make or apply that decision.
- Assumption exposure prioritizes declared uncertainty; it is not probability or automated judgment.
- Release readiness validates declared controls; it never deploys, changes traffic, or triggers rollback.
- Feature adoption describes ordered pseudonymous events; it neither proves causality nor identifies people or selects product actions.
- Lifecycle planning validates human-declared safeguards; it never recommends, announces, migrates, disables, or deletes a capability.
- One deployment is one trusted team; a bearer token is not tenant isolation.

## Honest implementation status

| Area | Current behavior |
|---|---|
| AI/NLP | Explainable deterministic baselines; no trained production model claimed |
| Storage | D1 for standalone histories and connected versioned runs |
| Integrations | Connector utilities exist; scheduled multi-source synchronization does not |
| Experiment analysis | Data-quality audit and descriptive rates; no automatic significance claim |
| Outcome analysis | Monitoring signals; no causal attribution |
| Learning retrieval | Weighted lexical search; no embedding or semantic-equivalence claim |
| Decision calibration | Deterministic Brier score and reliability bands; no causal claim |
| Evidence integrity | Deterministic freshness and coverage checks; no sampling-validity claim |
| Research planning | Exact bounded portfolio optimization; human effort and action assumptions remain inputs |
| Strategy alignment | Deterministic effort-allocation audit; objectives and mappings require human review |
| Portfolio rebalancing | Exact bounded search for up to 18 candidates; declared effort, dependencies and mappings remain human inputs |
| Portfolio resilience | Deterministic bounded scenario analysis; scenario likelihood and business impact remain human judgments |
| Benefits realization | Deterministic target progress with reviewed attribution; no causal or fabricated ROI claim |
| Investment assurance | Deterministic completeness checks plus named human decisions; no automated go/kill claim |
| Assumption risk | Deterministic importance/uncertainty heuristic; assumptions and validation methods remain human inputs |
| Release readiness | Deterministic declared-control checks; no deployment access or safety guarantee |
| Feature adoption | Deterministic ordered-event funnels with small-cohort suppression; no causal or identity-resolution claim |
| Product lifecycle | Deterministic notice, migration, dependency, communication and approval checks; no automatic retirement |
| Authentication | Shared bearer token for a small trusted deployment |
| Cost | No paid API required; Cloudflare quotas still apply |

## Repository structure

```text
.
├── feedback_collector/                 Project 1
├── sentiment_analyzer/                 Project 2
├── topic_modeler/                      Project 3
├── feature_request_detector/           Project 4
├── voice_of_customer_dashboard/        Project 5
├── prioritization_engine/              Project 6
├── experiment-data-quality-auditor/    Project 7 and connected app
├── product_outcome_monitor/            Project 8
├── product_learning_memory/            Project 9
├── decision_calibration_engine/        Project 10
├── evidence_integrity_monitor/         Project 11
├── research_portfolio_optimizer/       Project 12
├── strategy_alignment_auditor/         Project 13
├── portfolio_rebalancing_simulator/    Project 14
├── portfolio_resilience_stress_tester/ Project 15
├── benefits_realization_tracker/       Project 16
├── investment_assurance_review/        Project 17
├── assumption_risk_register/           Project 18
├── release_readiness_controller/       Project 19
├── feature_adoption_analyzer/          Project 20
├── product_lifecycle_planner/          Project 21
├── .github/                            CI workflow
├── .gitignore
├── LICENSE
└── README.md
```

## Documentation

- [Connected contracts and limits](experiment-data-quality-auditor/docs/CONNECTED_WORKFLOW.md)
- [Connected workspace PRD](experiment-data-quality-auditor/docs/PRD.md)
- Each project folder contains its own implementation-aligned README and supporting schemas or documentation.

## Product principles

- Preserve evidence before generating recommendations.
- Keep assumptions and scoring inputs visible.
- Use deterministic code for validation and consequence-sensitive gates.
- Require human review for business estimates and product decisions.
- Fail closed when data quality is insufficient.
- Claim only what the code and tests support.

## License

The repository-level modules use [Apache License 2.0](LICENSE). Projects 7–21 include their own MIT licenses; imported modules retain their original notices.
