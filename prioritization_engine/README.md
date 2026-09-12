<div align="center">

# Project 6: Prioritization Engine

**Rank reviewed opportunities transparently against capacity and dependencies.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](../LICENSE)

</div>

Project 6 scores opportunities using explicit PM estimates, reports score contributions and uncertainty assumptions, and builds a capacity-aware portfolio. It does not invent business value from upstream sentiment or request volume.

## Product impact

- **Decision improved:** which reviewed opportunities fit the current capacity and declared product priorities.
- **Leading measures:** assessment completion, selected capacity, dependency exceptions and sensitivity to weights.
- **Portfolio value:** makes trade-offs and human assumptions inspectable before experiments or roadmap commitments.
- **Stop condition:** a high score is not a revenue forecast, and the greedy portfolio is not a global mathematical optimum.

## Place in ProdMind

Projects 1–5 produce evidence-linked opportunity candidates. A PM supplies reviewed value, strategy, feasibility, urgency, effort, risk, confidence, uncertainty and dependencies. Project 7 preserves the selected opportunity and evidence snapshot when an experiment is created.

## Implemented capabilities

- Validated opportunity and scoring contracts
- Configurable weights normalized to one
- Explainable contribution-based score
- Deterministic seeded Monte Carlo uncertainty in standalone mode
- Exact non-dominated/Pareto identification
- Explicit dependency validation
- Greedy capacity-aware portfolio construction
- Missing-dependency reporting
- Optional D1 run history
- Authenticated Worker API and responsive light/dark frontend
- Evaluation fixtures and deterministic tests

The connected workflow disables Monte Carlo simulation to keep Worker requests lightweight and does not attach a synthetic uncertainty band.

## Frontend

The `public/` application loads opportunities, accepts weights and capacity, invokes the shared engine, and renders rankings, score contributions, uncertainty, Pareto status, portfolio selection, and dependency warnings.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report service and D1 status |
| `POST` | `/api/prioritize` | Score and select a bounded opportunity set |
| `GET` | `/api/runs` | List persisted prioritization runs |

## Run, evaluate and test

```bash
cd prioritization_engine
npm install
npm run check
npm run evaluate
npm run dev
```

## Deploy

Create and migrate the D1 database, set `API_TOKEN` and allowed origins, and run `npm run deploy`.

## Structure

```text
public/engine.js    Shared scoring and portfolio engine
public/             Interactive frontend
src/worker.js       Secured API and D1 history
migrations/         Run-history table
schema/             Opportunity and result contracts
evaluation/         Deterministic examples
test/               Engine and HTTP tests
```

## Honest limits

- Estimates remain subjective even when the calculation is transparent.
- Monte Carlo distributions are supplied assumptions, not learned forecasts.
- The greedy selector is not a globally optimal integer-programming solver.
- Dependencies are explicit and do not discover hidden technical constraints.
- Historical outcomes are searchable in Project 9 but do not automatically retrain scoring weights.
- Human review remains required before roadmap or experiment commitments.

## License

Licensed under the repository-level [Apache License 2.0](../LICENSE).
