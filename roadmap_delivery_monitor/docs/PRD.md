# Product requirements

## Problem

Project 40 establishes a feasible delivery baseline. Product and delivery leaders still need a truthful, repeatable way to compare that baseline with actual execution without replacing evidence with status narratives or allowing the tool to alter commitments automatically.

## Users

- Product leaders reviewing roadmap execution
- Delivery managers coordinating work across teams
- Engineering and design leads supplying actual progress evidence
- Portfolio councils deciding whether to continue, replan, or escalate

## MVP requirements

1. Accept a bounded Project 40 `1.0.0` schedule and retain its lineage.
2. Accept 1–24 chronological snapshots covering every scheduled item exactly once.
3. Model completed work units, consumed capacity-days, remaining estimate, actual dates, status, evidence, and blockers.
4. Reject decreasing observations, impossible status/date combinations, unknown work, and missing coverage.
5. Calculate time-phased planned work, earned work, schedule variance, capacity variance, and transparent indices.
6. Detect dependency violations, missed deadlines, stale reporting, excessive gaps, and overdue blockers.
7. Block a `continue` decision when any declared control fails.
8. Keep replan and escalation as external human actions.
9. Expose an authenticated same-origin Worker API and accessible light/dark UI.

## Non-goals

- Updating a task tracker, roadmap, assignment, estimate, or blocker
- Evaluating individual employee performance
- Predicting completion probability or causal impact
- Claiming statistical confidence or certified EVMS conformity
- Replacing delivery review, estimation, or risk judgment

## Acceptance

- Identical valid input produces identical output.
- Every item retains Project 40 and customer-evidence lineage.
- A continuation cannot pass stale snapshots, dependency violations, deadline failures, or declared variance limits.
- Results state the method and its decision boundaries.
