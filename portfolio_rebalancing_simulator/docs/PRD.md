# Product requirements

## Problem

A strategy-alignment audit explains the current portfolio but does not show a feasible path to improve it. Product leaders need scenarios that respect existing commitments, capacity, dependencies, and the cost of changing direction.

## Users

Product leaders, portfolio managers, product managers, and delivery leads conducting a portfolio review.

## Jobs

1. Load the current selected and deferred opportunity backlog.
2. Apply reviewed strategic ranges and mappings.
3. Protect locked commitments.
4. Find a minimum-disruption aligned scenario.
5. Inspect every addition, removal, dependency, and source-evidence link.

## Acceptance criteria

- Search at most 18 uniquely identified candidates exactly.
- Enforce capacity, locks, mappings, and dependencies.
- Minimize range violation before disruption and score.
- Preserve evidence lineage.
- Report the closest feasible scenario when exact alignment is unavailable.
- Report infeasibility when no operational subset exists.
- Never mutate a saved ranking.
- Fail closed without API authentication.

## Non-goals

- Automatic roadmap updates
- Calendar scheduling
- Realized-benefit forecasting
- Transition-cost estimation
- Multi-objective fractional mappings
- Enterprise-scale solver claims
