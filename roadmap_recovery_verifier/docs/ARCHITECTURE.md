# Architecture

## Boundary

```text
Project 40 schedule + baseline Project 41 delivery
                         ↓
Approved Project 42 recovery plan
                         ↓
Action execution outcomes + later Project 41 delivery
                         ↓
Timing, effort, approval, evidence and control checks
                         ↓
Named human close, continue-monitoring or escalate decision
```

Project 7 reconstructs all authoritative upstream reports server-side. The verifier is stateless and performs no network calls.

## Verification model

- **Completeness:** exactly one outcome per selected action.
- **Delivery:** all actions completed no later than their declared due dates.
- **Effort:** actual effort stays within a visible tolerance around planned effort.
- **Governance:** completed baseline-changing actions have prior approval.
- **Maturity:** the later Project 41 observation follows the latest completion by the declared minimum.
- **Effectiveness:** every control that failed before Project 42 is present and passing in the later Project 41 report.
- **Lineage:** original customer evidence and every source report remain linked.

These are deterministic record checks, not causal inference.

## HTTP boundary

The Worker provides constant-work bearer-token checking, same-origin enforcement, streamed 2 MB request limits, security headers, structured errors, and static assets. The browser renders returned values as text.
