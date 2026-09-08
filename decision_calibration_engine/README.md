<div align="center">

# Project 10: Product Decision Calibration Engine

**Compare product confidence with resolved monitored outcomes.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 10 closes a judgment-quality gap in [ProdMind](../README.md). Project 6 records a PM’s confidence before prioritization; Projects 7 and 8 later record the decision and monitored result. This engine joins those records and reports whether stated confidence aligns with resolved outcomes across the portfolio.

## Place in ProdMind

```text
Project 6 confidence forecast
          +
Project 7 reviewed decision
          +
Project 8 monitored outcome
          ↓
Project 10 calibration review
          ↔
Project 9 source learning and evidence
```

The engine does not automatically change scoring weights or evaluate individual employees. It creates a portfolio-level feedback loop for future product judgment.

## What is implemented

- Extracts confidence from ranked Project 6 opportunities
- Joins decisions and latest Project 8 monitoring states
- Preserves run, opportunity, experiment, decision, monitor, and evidence IDs
- Treats `sustained` as resolved success
- Treats `below_target` and `at_risk` as resolved non-success
- Keeps `emerging` and `unmonitored` decisions unresolved
- Calculates Brier score, mean confidence, observed rate, confidence bias, and mean absolute error
- Produces five reliability bands with sample counts and gaps
- Warns when fewer than 20 decisions are resolved
- Provides authenticated standalone and connected Worker paths
- Includes a responsive light/dark frontend
- Requires no paid model, statistics API, or database beyond existing D1

## Why this idea is viable

Trustworthy experimentation begins with an explicit expected effect and continues after the experiment by collecting and learning from results. Probabilistic forecast evaluation also requires separating overall scoring rules from calibration diagnostics. Project 10 applies those principles conservatively: deterministic calculations produce the report, and humans interpret whether process changes are justified.

## Frontend

The standalone interface accepts complete ProdMind run exports and displays aggregate metrics and reliability bins. The primary Project 7 workspace calls the same engine over recent D1 runs, removing the need for manual export in the connected workflow.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report configuration status |
| `POST` | `/api/calibrate` | Analyze supplied forecasts or complete ProdMind runs |

The connected product exposes `GET /api/calibration?limit=20` through Project 7.

## Calculation

For binary outcomes, the implemented Brier score is:

```text
mean((confidence - observed)²)
```

A lower score indicates smaller probability error for this sample. It must be reviewed alongside reliability bins, sample size, resolution coverage, and product context.

## Run and deploy

```bash
cd decision_calibration_engine
npm install
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
# npx wrangler deploy
```

## Structure

```text
src/calibration.js  Extraction and deterministic calculations
src/worker.js       Authenticated standalone API
public/             Working light/dark frontend
tests/              Calculation, lineage and HTTP tests
docs/               PRD, architecture and metrics
wrangler.jsonc      Cloudflare configuration
```

## Honest limits

- “Success” means the declared Project 8 target was sustained; it is not a causal claim.
- Brier score is not a standalone measure of calibration or decision quality.
- Five fixed bins can be unstable, especially with small samples.
- Results can be distorted by changing segments, goals, metrics, and time horizons.
- The engine does not judge PM performance or recommend personnel decisions.
- Recalibration requires governance and prospective validation; it is not automated.

## Research foundation

- [Microsoft: pre-experiment hypothesis and success metrics](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/patterns-of-trustworthy-experimentation-pre-experiment-stage/)
- [Microsoft: post-experiment learning patterns](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/patterns-of-trustworthy-experimentation-post-experiment-stage/)
- [Hoessly et al.: misconceptions about Brier score and calibration](https://pmc.ncbi.nlm.nih.gov/articles/PMC12818272/)
- [Dimitriadis, Gneiting, and Jordan: reliability diagrams and score decomposition](https://arxiv.org/abs/2008.03033)

## License

[MIT](LICENSE)
