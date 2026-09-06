<div align="center">

# Project 8: Product Outcome Monitor

**Verify whether expected product outcomes persist after an experiment decision.**

[![ProdMind lifecycle](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml/badge.svg)](https://github.com/MadanMohan0537/prodmind/actions/workflows/experiment-data-quality-auditor.yml)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE)

</div>

An experiment readout should not be the end of product learning. This module follows a Project 7 decision into the post-rollout period, measures whether its declared outcome is emerging or sustained, detects reversal and guardrail breaches, and directs a human review.

~~~text
Project 7 decision → Monitoring plan → Baseline and observed metrics
                   → Change signals → Guardrail review → Follow-up action
~~~

## Why Idea 8 is viable

ProdMind already connects feedback, opportunities, priorities, experiments and decisions. The missing step was outcome follow-through. Project 8 closes that loop without adding another content generator.

The product is grounded in two useful principles:

- Google HEART maps product goals to user-centered signals and metrics.
- NIST process-monitoring guidance distinguishes control signals from product specifications and warns that estimated limits can be unreliable with limited baseline data.

The MVP applies these ideas conservatively. It surfaces patterns for review and never claims a product decision caused them.

## What works

- Explicit linkage to opportunity, experiment and decision IDs
- Baseline mean and sample standard deviation
- Descriptive three-sigma control band
- EWMA with lambda 0.2 for gradual movement
- Direction-aware relative target comparison
- Three-observation persistence requirement
- Early-versus-late reversal detection
- Minimum and maximum guardrail thresholds
- Limited-baseline warning
- Deterministic follow-up actions
- Authenticated, stateless Cloudflare Worker API
- Responsive light/dark interface and synthetic sample
- Core, integration-contract and HTTP tests

## Run locally

~~~bash
cd product_outcome_monitor
node --test
npx wrangler secret put API_TOKEN
npx wrangler dev
~~~

For local development, place 'API_TOKEN=your-local-token' in the ignored '.dev.vars'.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Public configuration status |
| POST | /api/analyze | Analyze one complete monitoring snapshot |

The analysis endpoint requires 'Authorization: Bearer <token>' and JSON. Requests are limited to 500 KB.

## Input

See [the runnable synthetic sample](public/sample.json). A plan requires a title, opportunity/experiment/decision IDs, metric name and unit, desired direction, decimal target change, owner, cadence, baseline observations, post-decision observations and optional guardrails.

Timestamps must be unique, increasing and formatted as exact UTC milliseconds. Observed periods must follow the baseline period.

## Output states

| State | Meaning |
|---|---|
| sustained | Latest three observations meet the target |
| emerging | Latest value meets target but persistence is incomplete |
| below_target | Declared target is not currently met |
| at_risk | Reversal or guardrail breach requires review |

The response includes baseline statistics, latest change, EWMA points, control-limit signals, guardrail breaches and a deterministic review action.

## Project 7 handoff

'fromLearningDecision' maps Project 7 learning-ledger identifiers and evidence IDs into a monitoring-plan draft. Metrics, baseline, target, owner and cadence still require explicit product-team input.

The connection preserves lineage:

~~~text
feedback → opportunity → experiment → decision → monitored outcome
~~~

There is no silent database synchronization. This stateless MVP accepts a complete snapshot.

## Analytical boundary

Three-sigma and EWMA outputs are monitoring signals, not hypothesis tests. The module does not adjust for seasonality, traffic mix, concurrent launches, missing data, repeated looks or confounding. It does not estimate causal effects or recommend automatic rollback.

## Deploy

~~~bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
~~~

No paid model, database or third-party service is required. Configure rate limiting and access controls before broad exposure.

## Structure

~~~text
product_outcome_monitor/
├── src/monitor.js       Deterministic analysis
├── src/worker.js        Authenticated Worker API
├── public/              Working interface
├── tests/               Core and HTTP tests
├── examples/            Synthetic snapshot
├── docs/                PRD, architecture and metrics
├── wrangler.jsonc
└── README.md
~~~

## Research

- [Google HEART metrics framework](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)
- [NIST control-chart guidance](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc32.htm)
- [NIST EWMA guidance](https://www.itl.nist.gov/div898/handbook/mpc/section2/mpc2211.htm)

## License

[MIT](LICENSE)
