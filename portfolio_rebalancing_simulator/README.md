<div align="center">

# Project 14: Strategic Portfolio Rebalancing Simulator

**Find the smallest feasible portfolio change that improves strategic alignment.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Project 13 identifies where selected product effort is inconsistent with declared strategic objectives. A portfolio review still needs to answer a harder question: what is the least disruptive combination of additions and removals that improves the allocation without violating capacity, dependencies, or locked commitments?

Project 14 searches the complete bounded Project 6 backlog and produces a reviewable rebalance scenario. It never modifies a saved ranking.

## Product impact

- **Decision improved:** what smallest set of portfolio additions and removals can improve strategic allocation within constraints.
- **Leading measures:** range violation, change count, capacity use, retained commitments and scenario acceptance.
- **Portfolio value:** turns a strategy exception into a concrete, evidence-linked alternative without silently rewriting the roadmap.
- **Stop condition:** an exact solution is optimal only for the bounded candidate set, declared inputs and objective order.

## Place in ProdMind

```text
Project 6 ranked backlog and selected portfolio
                       +
Project 13 objectives, mappings, and allocation ranges
                       ↓
Project 14 exact rebalance simulation
                       ↓
Add / remove / retain scenario for human review
                       ↺
Approved changes return through the normal Project 6 workflow
```

## What is implemented

- Reads selected and deferred Project 6 opportunities
- Uses the same objective mappings and ranges as Project 13
- Enforces a total delivery-capacity constraint
- Supports locked current commitments
- Enforces opportunity dependencies
- Requires every simulated item to have a strategic objective
- Minimizes range violation first
- Then minimizes additions and removals
- Then maximizes total Project 6 score and capacity use
- Returns added, removed, retained, and complete selected sets
- Preserves run, opportunity, dependency, objective, and evidence identities
- Uses canonical `portfolioItemId` values so repeated opportunity IDs remain distinct across runs
- Returns `aligned`, `closest_feasible`, or `infeasible`
- Reports exact-search combinations and optimality scope
- Includes an authenticated Cloudflare Worker API
- Includes responsive light and dark interfaces
- Integrates directly with the Project 7 workspace
- Requires no paid optimizer, model, or external API

## Optimization order

For every feasible subset, the simulator applies this deterministic lexicographic objective:

1. Minimize total objective-range violation.
2. Minimize changes from the currently selected portfolio.
3. Maximize the sum of Project 6 scores.
4. Maximize capacity utilization.
5. Apply a stable subset-order tie-break.

A subset is considered operationally feasible only when:

- total effort does not exceed capacity;
- all locked commitments remain selected;
- every dependency is selected;
- every selected item maps to a declared objective.

The simulator enumerates at most 18 opportunities, or 262,144 subsets. Its `optimal: true` statement applies only to that bounded candidate set, declared constraints, and objective order.

## API

### Standalone

```http
POST /api/rebalance
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

```json
{
  "runs": [],
  "strategy": {
    "objectives": [],
    "mappings": []
  },
  "options": {
    "capacity": 20,
    "lockedPortfolioItemIds": ["run-2026-q4:opp-1"]
  }
}
```

### Connected workspace

```http
POST /api/portfolio-rebalance
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

The connected request contains `strategy`, `capacity`, and optional `lockedPortfolioItemIds`. Project 7 supplies recent D1-backed runs and invokes the same engine directly. Legacy `lockedOpportunityIds` and opportunity-only mappings remain supported when each ID occurs in only one run; ambiguous values are rejected.

## Run locally

```bash
cd portfolio_rebalancing_simulator
npm install
npm run check
npm run dev
```

Create `.dev.vars`:

```text
API_TOKEN=replace-with-a-long-random-secret
```

## Deploy

```bash
npx wrangler secret put API_TOKEN
npm run deploy
```

## Structure

```text
portfolio_rebalancing_simulator/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   └── PRD.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── rebalance.js
│   └── worker.js
├── tests/
│   └── rebalance.test.js
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Honest limits

- A mathematical optimum is not a management decision.
- Results depend on human-reviewed effort, score, mapping, range, lock, and dependency inputs.
- Score sums are used only after alignment and disruption objectives; they are not forecasts of realized value.
- The simulator does not estimate transition costs or sunk costs.
- It does not schedule teams or calendar dates.
- It does not modify D1 rankings or approve changes.
- At most 18 candidates are accepted for exact enumeration.
- Objective mappings are one-to-one in the current strategy model.

## Research basis

- [APM: What is portfolio management?](https://www.apm.org.uk/resources/what-is-project-management/what-is-portfolio-management/)
- [GOV.UK: Deciding on priorities](https://www.gov.uk/service-manual/agile-delivery/deciding-on-priorities)
- [GOV.UK: Developing a roadmap](https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap)
- [APM: Portfolio prioritisation and benefits](https://www.apm.org.uk/blog/maximising-organisational-success-through-benefits-management-and-portfolio-prioritisation/)
- [UK Government Product Manager capability](https://ddat-capability-framework.service.gov.uk/role/product-manager)

These sources support ongoing portfolio control, strategic alignment, transparent prioritization, and resource awareness. The exact solver and objective ordering are ProdMind implementation decisions.

## License

[MIT](LICENSE)
