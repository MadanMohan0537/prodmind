<div align="center">

# Project 13: Product Strategy Alignment Auditor

**Trace where selected product capacity actually goes against declared strategic objectives.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Product teams commonly give individual opportunities a “strategic alignment” score. That number cannot answer portfolio questions such as:

- Which objective receives most of the selected delivery capacity?
- Which roadmap items do not map to any objective?
- Which objectives fall outside leadership’s declared allocation range?
- Is the portfolio balanced, or concentrated around one goal?

Project 13 answers those questions with deterministic allocation analysis. It combines Project 6’s selected opportunities and effort estimates with a reviewed strategy model, while preserving the original run, opportunity, and evidence identities.

## Place in ProdMind

```text
Declared strategic objectives and allocation ranges
                         +
Project 6 selected opportunities and effort
                         ↓
Project 13 strategy alignment audit
                         ↓
Transparent portfolio review
                         ↺
Projects 7–12 provide outcomes, learning,
calibration, evidence checks, and research plans
```

The auditor does not rewrite the strategy, change the roadmap, or convert an objective into a fabricated business estimate.

## What is implemented

- Accepts 1–20 reviewed strategic objectives
- Requires objective target shares to sum to 100%
- Supports minimum and maximum allocation ranges
- Maps each selected opportunity to at most one primary objective
- Calculates effort allocation and actual portfolio share by objective
- Reports target-share gaps and total allocation deviation
- Reports alignment coverage by mapped effort
- Calculates objective-allocation concentration
- Flags underallocated and overallocated objectives
- Flags selected work without a strategic objective
- Handles an empty portfolio without inventing findings
- Ignores deferred Project 6 opportunities
- Preserves run, opportunity, and evidence lineage
- Includes an authenticated Cloudflare Worker API
- Includes system-aware light and dark interfaces
- Integrates directly with the Project 7 D1 workspace
- Requires no paid model or software service

## Strategy contract

```json
{
  "id": "fy27-product-strategy",
  "objectives": [
    {
      "id": "activation",
      "title": "Improve successful activation",
      "targetShare": 0.6,
      "minShare": 0.5,
      "maxShare": 0.7
    },
    {
      "id": "retention",
      "title": "Improve 90-day retention",
      "targetShare": 0.4,
      "minShare": 0.3,
      "maxShare": 0.5
    }
  ],
  "mappings": [
    {
      "opportunityId": "opp-topic-1",
      "objectiveId": "activation"
    }
  ]
}
```

One primary objective per opportunity makes the allocation auditable and prevents the same effort from being counted multiple times. Multi-objective fractional allocation is deliberately outside the MVP.

## Metrics

| Metric | Meaning |
|---|---|
| Alignment coverage | Selected effort mapped to an objective divided by total selected effort |
| Allocation deviation | Half the sum of absolute target-share gaps |
| Allocation concentration | Sum of squared actual objective shares |
| Objective gap | Actual share minus target share |
| Range status | Underallocated, within range, or overallocated |

These metrics describe the declared portfolio. They do not prove that the strategy or effort estimates are correct.

## API

### Standalone audit

```http
POST /api/audit
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

```json
{
  "runs": [],
  "strategy": {
    "id": "fy27",
    "objectives": [],
    "mappings": []
  }
}
```

### Connected audit

The main workspace exposes:

```http
POST /api/strategy-audit
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

The connected route accepts the strategy object, retrieves recent D1-backed runs, and executes the same `auditStrategyAlignment` implementation without a network hop.

## Run locally

```bash
cd strategy_alignment_auditor
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
strategy_alignment_auditor/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   └── PRD.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── alignment.js
│   └── worker.js
├── tests/
│   └── alignment.test.js
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Honest limits

- Opportunity effort and strategy mappings require human review.
- One opportunity maps to one primary objective in the MVP.
- Allocation share does not measure delivered value or benefits.
- The concentration metric has no universal “good” threshold.
- The auditor does not compare financial returns or estimate opportunity cost.
- It does not automatically reprioritize, stop, or fund work.
- Cross-run opportunity IDs must be unique for unambiguous mappings.
- One deployment remains a trusted-team workspace, not tenant-isolated SaaS.

## Research basis

- [APM: What is portfolio management?](https://www.apm.org.uk/resources/what-is-project-management/what-is-portfolio-management/)
- [GOV.UK: Deciding on priorities](https://www.gov.uk/service-manual/agile-delivery/deciding-on-priorities)
- [GOV.UK: Developing a roadmap](https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap)
- [UK Government Product Manager capability](https://ddat-capability-framework.service.gov.uk/role/product-manager)
- [GAO: Portfolio reviews and analytical tools](https://www.gao.gov/products/gao-15-466)

These sources support alignment, capacity awareness, transparent prioritization, and periodic portfolio review. ProdMind’s metrics and schema are its implementation choices, not standards defined by those sources.

## License

[MIT](LICENSE)
