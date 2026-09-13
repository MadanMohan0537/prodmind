<div align="center">

# Project 15: Product Portfolio Resilience Stress Tester

**Test whether a product portfolio survives declared capacity, dependency, and effort shocks before commitment.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Projects 6, 13, and 14 can select, audit, and rebalance a portfolio. Project 15 asks the next question: does that portfolio remain feasible when an explicitly defined scenario changes capacity, removes a dependency, or expands effort?

## Product impact

- **Decision improved:** whether a selected or proposed portfolio is resilient enough for leadership review.
- **Leading measures:** critical scenario count, weakest-scenario score, capacity overrun, dependency failures, and allocation drift.
- **Portfolio value:** exposes fragile commitments before the roadmap is accepted while preserving source evidence.
- **Stop condition:** scenario scores are deterministic review indices, not probabilities or forecasts.

## What is implemented

- Saved Project 6 portfolio or explicit Project 14 scenario selection
- Project 13 objective mappings and allocation ranges
- Canonical `portfolioItemId` identity across runs
- Capacity-loss scenarios
- Unavailable commitment and dependency scenarios
- Per-item effort multipliers
- Strategic allocation drift
- Evidence-linked at-risk items
- Weakest-scenario and aggregate summaries
- Bounded 1–12 scenario and 100-item contracts
- No paid model, optimizer, or API

## Scenario contract

```json
{
  "capacity": 20,
  "portfolioItemIds": ["run-q4:opp-onboarding"],
  "scenarios": [
    {"id":"capacity-loss","name":"Capacity falls 25%","capacityFactor":0.75},
    {"id":"dependency-loss","unavailablePortfolioItemIds":["run-q4:opp-platform"]},
    {"id":"effort-growth","effortMultipliers":[{"portfolioItemId":"run-q4:opp-onboarding","multiplier":1.5}]}
  ]
}
```

## Run the engine

```bash
cd portfolio_resilience_stress_tester
npm install
npm test
```

## API and deployment

```http
POST /api/stress
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

```bash
npx wrangler secret put API_TOKEN
npm run deploy
```

The Worker streams and bounds the request body at 2 MB, fails closed without a token, and serves a responsive system-aware light/dark interface.

## Structure

```text
docs/       PRD, architecture, and metrics
src/        Deterministic engine and Worker API
tests/      Engine and HTTP contracts
public/     Responsive light/dark interface
```

## Honest limits

- Scenario likelihood is not estimated.
- The scoring penalties are visible product policy, not a statistical model.
- Effort, mappings, capacity, and scenario shocks remain human-reviewed inputs.
- The engine does not model calendar schedules, transition costs, or resource skills.
- A resilient result applies only to the scenarios provided.
- No saved ranking or roadmap is modified.

## Research basis

- [APM: Project risk analysis and management](https://www.apm.org.uk/resources/whitepapers/project-risk-analysis-and-management/)
- [APM: What is a business case?](https://www.apm.org.uk/resources/what-is-project-management/what-is-a-business-case/)
- [PMI: Using scenario planning in portfolio management](https://www.pmi.org/learning/library/scenario-planning-project-portfolio-management-97)
- [PMI: Project portfolio management techniques](https://www.pmi.org/learning/library/project-portfolio-management-techniques-7624)
- [GAO: Portfolio reviews and analytical tools](https://www.gao.gov/products/gao-15-466)

These sources support explicit risk analysis, alternative evaluation, scenario planning, continuous portfolio alignment, and analytical review. The score and schema are ProdMind implementation decisions.

## License

[MIT](LICENSE)
