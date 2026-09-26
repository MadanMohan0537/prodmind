# Product Exception Exit & Corrective-Action Verifier

**Project 27 of ProdMind verifies that remediation is effective before an exception is closed.**

It joins a Project 26 active exception to a later Project 25 monitor, verifies that the original target and remediation obligation are resolved, evaluates explicit effectiveness tests over a declared observation window, and requires independent approval. It preserves the failed-control history and never mutates either upstream report.

## Deterministic checks

- The Project 26 exception was actually active.
- Governance-pack and portfolio lineage match the follow-up monitor.
- The waived check or obligation is now resolved.
- The linked remediation obligation is completed, evidenced, and not overdue.
- Every effectiveness test passed with evidence.
- The declared observation window is complete.
- Product and Governance approve closure; high or critical residual risk also requires Risk approval.
- The requester cannot approve or conduct the exit review.

```text
Project 26 active exception + later Project 25 monitor
                         ↓
target + remediation + tests + observation + approvals
                         ↓
Project 27 deterministic exit verification
                         ↓
verified_closed | blocked_close | action_required
```

The Worker and responsive light/dark frontend require no paid service or external model.

## Run

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

The standalone endpoint is `POST /api/exception-exits`. Project 7 reconstructs the baseline and follow-up chain server-side through its connected endpoint.

## Research basis

- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) informed control assessment, plans of action, and continuous monitoring.
- [NIST SP 800-37 Rev. 2](https://csrc.nist.gov/pubs/sp/800/37/r2/final) describes assessment and continuous monitoring as parts of disciplined risk management.
- [NIST Risk Management Framework](https://csrc.nist.gov/projects/risk-management) distinguishes implementation from assessing whether controls operate as intended and produce desired results.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) supports governed improvement based on assessed risk.

These sources inform the workflow; the result is not certification or legal compliance.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), and [metrics](docs/METRICS.md). Apache-2.0 licensed.
