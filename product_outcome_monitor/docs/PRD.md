# Product requirements: Product Outcome Monitor

## User and problem

Product managers, growth teams and product analysts need to verify whether an expected outcome persists after an experiment decision or staged launch. Experiment readouts are often treated as the end of the process even when novelty, rollout changes or guardrail deterioration appear later.

## Product promise

Connect a Project 7 decision to ongoing metric observations, surface deterministic change signals and guardrail breaches, and preserve the difference between monitoring evidence and causal explanation.

## MVP acceptance criteria

- Require opportunity, experiment and decision IDs.
- Require an explicit goal metric, direction, target change, owner and review cadence.
- Reject invalid, duplicate, future or non-increasing timestamps.
- Calculate baseline mean, sample deviation, three-sigma descriptive limits and EWMA.
- Detect sustained target performance, early-to-late reversal and guardrail breaches.
- Warn when baseline history is limited.
- Never claim the prior decision caused an observed change.
- Require API authentication and reject oversized requests.
- Support a light/dark responsive working interface and synthetic sample.

## Not in MVP

No live analytics connector, scheduled polling, D1 persistence, notifications, automatic rollback, causal inference, seasonal adjustment, segmentation, missing-data imputation or multi-tenant access.
