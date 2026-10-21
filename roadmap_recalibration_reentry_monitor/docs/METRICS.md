# Metrics

Project 52 reports control evidence, not business causality.

## Product metrics

| Metric | Definition | Desired direction |
|---|---|---|
| Approved-plan match rate | Trials retaining exact identity, owner, versions, and scope | Up |
| Shadow-first compliance | Trials beginning with zero active exposure | Up |
| Corrective-control survival | Required action controls operational at every stage | Up |
| Recurrence-free rate | Trials without a detected contributing-condition recurrence | Up |
| Guardrail pass rate | Trials within accuracy and incident limits | Up |
| Rollback readiness | Trials retaining tested, bounded recovery | Up |
| Unsupported continuation rate | Human continuation decisions blocked by failed checks | Track and reduce upstream |

## Engine outputs

- Stage count and timing
- Total sample size by reference class
- Baseline and candidate duration error
- Baseline and candidate capacity error
- Paired improvement
- Incident count
- Detected recurrence signals
- Per-check pass/fail details
- Final `verified_reentry`, `blocked_continue`, or `action_required` status

## Interpretation limits

Passing thresholds does not establish statistical significance, causal improvement, representative sampling, or future safety. Thresholds are reviewed policies, and evidence authenticity remains an operational responsibility.
