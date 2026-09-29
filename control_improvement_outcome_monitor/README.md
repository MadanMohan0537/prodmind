# Product Control Improvement Outcome Monitor

**Project 30 of ProdMind verifies whether an approved Project 29 improvement was delivered and followed by stable Project 28 evidence.**

An approved improvement portfolio is still a plan. This zero-paid-service Cloudflare Workers project checks delivery evidence, schedule and effort variance, evidence lineage, follow-up coverage, the promised verification window, and later recurrence before a named reviewer closes an action.

It never closes work, changes a control, infers causality, or treats an implementation record as effectiveness proof.

```text
Project 29 selected action + delivery evidence + later Project 28 surveillance
                                  ↓
plan + delivery + effort + lineage + observation + recurrence checks
                                  ↓
verified_effective | blocked_close | action_required
                                  ↓
named human close, continue, or escalate decision
```

## Checks

- The source Project 29 portfolio was approved and the action was selected.
- Delivery and success evidence are explicit.
- Completion occurred by the declared due date.
- Actual effort remains within the declared variance tolerance.
- Enough follow-up surveillance exists after implementation.
- Follow-up evidence matches the original governance, portfolio, and exit lineage.
- The promised verification window has elapsed.
- Later Project 28 surveillance is stable and recurrence-free.

## Run

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

The standalone endpoint is `POST /api/control-improvement-outcomes`. The frontend supports system light and dark modes.

## Research basis

- [NIST SP 800-137](https://csrc.nist.gov/pubs/sp/800/137/final) frames continuous monitoring as decision support for control effectiveness.
- [NIST's ISCM process definition](https://csrc.nist.gov/glossary/term/information_security_continuous_monitoring_process) includes responding to findings and reviewing/updating the monitoring program.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) includes an Improvement category driven by evaluation and lessons learned.
- [NIST SP 800-137A](https://csrc.nist.gov/pubs/sp/800/137/a/final) provides an approach for evaluating continuous-monitoring programs.

These sources inform the workflow; this project is not compliance certification or causal proof.

See the [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.

