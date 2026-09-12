<div align="center">

# Project 11: Product Evidence Integrity Monitor

**Know when the evidence behind a product decision is too stale, narrow, or broken to trust without review.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563EB)](LICENSE)

</div>

Product teams rarely fail because they have no feedback. They fail because five old tickets from one channel can look like broad customer evidence, missing IDs can silently break traceability, or opposing customer segments can be collapsed into one apparent signal.

Project 11 adds a deterministic evidence-quality gate to [ProdMind](../README.md). It inspects the evidence already linked to every opportunity and shows what a PM must review before reusing that evidence for prioritization, experimentation, or future planning.

## Product impact

- **Decision improved:** whether the evidence behind an opportunity is fit for another consequential decision.
- **Leading measures:** broken lineage, freshness, source concentration, segment gaps and review status.
- **Portfolio value:** makes weak evidence visible before it is amplified by scoring, experimentation or strategy work.
- **Stop condition:** the integrity score is a policy heuristic, not proof of sampling validity or representativeness.

## Place in ProdMind

```text
Projects 1–5: customer evidence
              ↓
Project 11: evidence integrity checks
              ↓
Project 6: reviewed prioritization
              ↓
Projects 7–10: experiments, outcomes, memory and calibration
              ↺
       evidence is reassessed as it ages
```

The monitor does not delete evidence, infer business value, or automatically block a human decision. It makes evidence limitations visible and traceable.

## What is implemented

- Evidence-ID resolution and broken-lineage blocking
- Canonical `portfolioItemId` values that keep repeated opportunity IDs distinct across runs
- Configurable freshness window and stale-record share
- Source diversity, largest-source share, and concentration index
- Known-segment coverage and unknown-segment share
- Small-sample warnings
- Polarized-sentiment review flags
- Opportunity-level integrity score and explainable penalties
- Portfolio summary ordered by highest risk
- Original run, opportunity, and evidence identities in every result
- Authenticated Cloudflare Worker API with a streamed 2 MB body limit
- Responsive standalone interface with system-aware light and dark themes
- Direct integration with the authenticated Project 7 workspace
- Seven focused tests plus the repository-wide lifecycle suite

## Integrity policy

Default thresholds are deliberately visible:

| Check | Default | Finding |
|---|---:|---|
| Evidence age | 90 days | Records beyond the window are stale |
| Minimum evidence | 5 records | Smaller sets receive a high-severity warning |
| Minimum sources | 2 | One-channel evidence receives a coverage warning |
| Largest source share | 70% | Higher concentration receives a high-severity warning |
| Known segments | 2 | Narrow or unknown coverage requires review |
| Positive and negative shares | 20% each | The signal is marked polarized for contextual review |

The score begins at 100 and subtracts documented penalties. It is a triage device, not a statistical confidence interval and not proof that a customer need is real or absent.

## API

### Health

```http
GET /api/health
```

### Assess exported ProdMind runs

```http
POST /api/assess
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

```json
{
  "runs": [{"id": "run-1", "evidence": [], "opportunities": []}],
  "policy": {
    "asOf": "2026-09-10T00:00:00Z",
    "maxAgeDays": 90,
    "minSources": 2,
    "minSegments": 2,
    "maxSourceShare": 0.7,
    "minEvidence": 5
  }
}
```

The connected workspace exposes the same engine through `GET /api/evidence-integrity` against recent D1-backed runs, so teams do not need to export and re-upload data.

## Run locally

Node.js 22.13 or later is recommended.

```bash
cd evidence_integrity_monitor
npm install
npm run check
npm run dev
```

Create `.dev.vars` locally:

```text
API_TOKEN=replace-with-a-long-random-secret
```

## Deploy without a paid model

```bash
npx wrangler secret put API_TOKEN
npm run deploy
```

No LLM, vector database, or paid API is required. Cloudflare account limits still apply.

## Project structure

```text
evidence_integrity_monitor/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── METRICS.md
│   └── PRD.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── integrity.js
│   └── worker.js
├── tests/
│   └── integrity.test.js
├── LICENSE
├── package.json
└── wrangler.jsonc
```

## Honest limits

- Age is a configurable review heuristic. Older qualitative evidence can remain valid.
- Multiple sources do not guarantee representative sampling.
- A source-concentration index describes distribution, not research quality.
- Positive and negative sentiment can reflect legitimate segment differences rather than contradiction.
- Unknown segments are surfaced but never guessed.
- The monitor evaluates linked evidence, not every source record an organization may possess.
- Findings require a PM or researcher to inspect the original evidence.

## Research basis

- [GOV.UK: plan user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service)
- [GOV.UK: continuous user research](https://www.gov.uk/service-manual/user-research/how-user-research-improves-service-design)
- [NIST AI RMF Playbook: Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
- [NIST: Data Layers and Feedback Loops](https://www.nist.gov/el/applied-economics-office/data-layers-and-feedback-loops)
- [Martin Fowler: governing data products with fitness functions](https://martinfowler.com/articles/fitness-functions-data-products.html)

These references support continuous evidence collection, explicit quality checks, traceability, and ongoing monitoring. The exact ProdMind thresholds are product-policy defaults, not claims made by those sources.

## License

[MIT](LICENSE)
