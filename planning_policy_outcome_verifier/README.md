# Project 33 — Product Planning Policy Experiment Outcome Verifier

Project 33 closes the learning loop opened by Project 32. It verifies whether a completed planning-policy experiment met its **predeclared** primary target without breaching its guardrail, and prevents a human `adopt` decision from being represented as verified when the evidence is incomplete.

## Why it belongs in ProdMind

Projects 30 and 31 measure product-outcome quality and calibration. Project 32 turns the resulting gaps into reversible policy experiments. This project provides the missing post-experiment gate:

1. preserve the approved experiment and its upstream outcome lineage;
2. compare observations with declared targets rather than moving goalposts;
3. verify timing, observation window, sample size, and evidence;
4. record a named human decision: `adopt`, `extend`, or `rollback`.

It does **not** claim causal attribution, change a planning policy, edit estimates, or rank people.

## Decision model

| Human decision | Prerequisites | Result |
| --- | --- | --- |
| `adopt` | Every deterministic check passes | `verified_adopt` |
| `adopt` | Any check fails | `blocked_adopt` |
| `extend` or `rollback` | Valid review | `action_required` |

Checks cover experiment timing, minimum observation window, minimum sample size, primary target, guardrail boundary, and evidence completeness.

## Run locally

```bash
npm test
npx wrangler dev
```

Set `API_TOKEN` as a Worker secret. The browser and API use the same origin; the token is never stored in source control.

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Send `POST /api/planning-policy-outcomes` with `Authorization: Bearer <token>` and a JSON body containing `runs`, `policyPlan`, and `input`.

## Architecture and security

- Pure deterministic engine in `src/outcomes.js`
- Authenticated Cloudflare Worker with a 2 MB streaming body limit
- Same-origin request enforcement and restrictive browser security headers
- Static responsive interface with light and dark themes
- No network calls, paid services, LLM dependency, cookies, or analytics
- Node built-in test runner; no runtime dependencies

See [product requirements](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md).

## Research basis

The design follows NIST guidance that confirmation experiments verify predictions and that sample size and uncertainty matter, while GAO evidence-based policymaking guidance motivates linking decisions to explicit evidence. These sources inform the control design; they do not certify this software.

## License

MIT
