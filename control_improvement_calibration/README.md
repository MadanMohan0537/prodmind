# Product Control Improvement Calibration & Learning Engine

**Project 31 of ProdMind turns verified Project 30 outcomes into evidence for better portfolio planning.**

Closing an improvement is not the end of the learning loop. Product organizations also need to know whether effort estimates were biased, work arrived on time, controls stayed effective, and addressed conditions recurred. This zero-paid-service Cloudflare Workers project measures those signals across a portfolio, compares them with explicit thresholds, and requires a named human to accept the baseline, adjust planning, or collect more evidence.

It never rewrites an estimate, changes a roadmap, ranks a person or team, or claims causality.

```text
Project 30 verified outcomes + declared calibration thresholds
                              ↓
effort + delivery + effectiveness + recurrence + evidence measures
                              ↓
calibrated | blocked_acceptance | action_required
                              ↓
named human accepts, adjusts, or gathers more evidence
```

## What it measures

- Portfolio effort bias and mean absolute effort error.
- On-time delivery and observed-effectiveness rates.
- Recurrence, observation-completeness, and evidence-coverage rates.
- Separate descriptive cohorts for preventive, detective, and governance responses.
- A descriptive effort multiplier for future human planning discussions.
- Explicit threshold checks, minimum sample size, and recorded reviewer rationale.

## Run locally

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

The standalone endpoint is `POST /api/control-improvement-calibration`. The responsive frontend follows the operating system's light or dark preference. The Worker uses no paid API, model, database, framework, or third-party runtime dependency.

## Request boundary

Send a Project 30 outcome report plus calibration policy and review. In the connected ProdMind workflow, Project 7 reconstructs Projects 18–30 on the server before invoking Project 31, preventing callers from substituting an intermediate decision artifact.

The engine returns descriptive evidence—not statistical inference, compliance certification, causal proof, or permission to alter plans automatically.

## Research basis

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) places lessons learned and improvement inside the risk-management lifecycle.
- [NIST SP 800-55 Volume 1](https://csrc.nist.gov/pubs/sp/800/55/v1/final) defines an information-security measurement program.
- [NIST SP 800-55 Volume 2](https://csrc.nist.gov/pubs/sp/800/55/v2/final) provides guidance for developing information-security measures.
- [GAO Cost Estimating and Assessment Guide](https://www.gao.gov/products/gao-20-195g) recommends updating estimates with actual costs so future estimates improve.

These sources inform the measurement loop; they do not make this project a compliance or audit product.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.
