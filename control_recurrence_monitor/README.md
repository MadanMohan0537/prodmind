# Product Control Regression & Recurrence Monitor

**Project 28 of ProdMind keeps watching after a Project 27 exception exit is verified.**

Remediation can work during an exit review and regress later. This zero-paid-service Cloudflare Workers project evaluates a bounded series of subsequent Project 25 monitors for target stability, maintained remediation, evidence lineage, sufficient snapshot coverage, and monitoring cadence.

It records a named `keep_closed`, `reopen`, or `escalate` decision. It never reopens an exception, changes a control, or treats the absence of observations as proof of stability.

```text
Project 27 verified exit + later Project 25 snapshots
                         ↓
lineage + target stability + remediation + coverage + cadence
                         ↓
Project 28 deterministic recurrence monitor
                         ↓
stable | blocked_keep_closed | action_required
```

## Checks

- Exit was `verified_closed`.
- Every follow-up snapshot matches the governance pack and portfolio item.
- The original target stays resolved.
- The remediation obligation remains completed and evidenced.
- The declared minimum snapshot count is met.
- Gaps do not exceed the declared monitoring cadence.
- Snapshots occur after exit verification and before the review date.

## Run

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

The standalone endpoint is `POST /api/control-recurrence`. The responsive frontend follows the browser's light/dark preference.

## Research basis

- [NIST SP 800-137](https://csrc.nist.gov/pubs/sp/800/137/final) describes continuous monitoring for ongoing visibility into control effectiveness.
- [NIST SP 800-137A](https://csrc.nist.gov/pubs/sp/800/137/a/final) covers assessment of continuous-monitoring programs.
- [NIST SP 800-37 Rev. 2](https://csrc.nist.gov/pubs/sp/800/37/r2/final) integrates assessment and continuous monitoring into risk management.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) supplies the broader control framework.

These sources inform the workflow; the product is not certification or a guarantee of future effectiveness.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.
