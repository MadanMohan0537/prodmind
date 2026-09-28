# Product Control Improvement Portfolio Planner

**Project 29 of ProdMind turns Project 28 recurrence evidence into a reviewable, capacity-feasible improvement portfolio.**

Monitoring is incomplete if findings never become owned improvement work. This zero-paid-service Cloudflare Workers project derives actionable targets only from real Project 28 failures or recurrences, validates proposed preventive, detective, or governance actions, and uses exact bounded optimization to maximize unique risk coverage within declared capacity.

It never changes a control, assigns work, closes a finding, or presents risk points as probabilities.

```text
Project 28 recurrence findings + improvement candidates + capacity
                              ↓
lineage + ownership + dependencies + dates + success measures
                              ↓
exact bounded portfolio optimization
                              ↓
approved | blocked_approval | action_required | no_findings
                              ↓
named human review; execution remains external
```

## What it validates

- Every candidate covers an actionable Project 28 surveillance finding.
- Evidence, governance-pack, exit-review, and portfolio identities remain intact.
- Every action has a named owner, response type, due date, success metric, and verification window.
- Dependencies refer to other declared candidates and are selected together.
- Capacity is explicit and never silently exceeded.
- Approval is blocked when the optimized portfolio misses the declared minimum risk coverage.
- Empty recurrence reports produce `no_findings`; the engine does not invent work.

## Optimization

At most 16 candidates are evaluated, making exhaustive subset evaluation bounded and reproducible. Each actionable surveillance target receives deterministic risk points from recurrence count and failed Project 28 checks. The objective maximizes **unique** risk points covered, then prefers lower effort, fewer actions, and stable input order.

Risk points are prioritization weights—not loss estimates, probabilities, or compliance scores.

## Run locally

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

Send authenticated JSON to `POST /api/control-improvements`. The standalone frontend follows the browser's light or dark color preference.

## Research basis

- [NIST SP 800-137](https://csrc.nist.gov/pubs/sp/800/137/final) defines continuous monitoring as decision support and includes responding to findings and updating the monitoring program.
- [NIST SP 800-137A](https://csrc.nist.gov/pubs/sp/800/137/a/final) provides a method for assessing continuous-monitoring programs.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) emphasizes improving risk-management outcomes using evaluation and lessons learned.
- [NIST IR 8286B](https://csrc.nist.gov/pubs/ir/8286/b/final) describes prioritizing risks according to enterprise impact and selecting risk responses.

These sources inform the workflow. This project does not certify compliance or determine enterprise risk appetite.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.

