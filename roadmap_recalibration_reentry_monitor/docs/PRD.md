# Product Requirements

## Problem

Project 51 authorizes a bounded retry after a recalibration incident, but an approval record cannot prove the actual retry retained its scope, exposure, corrective controls, monitoring, and rollback readiness.

## Users

- Product and portfolio leaders
- Delivery operations teams
- Estimation-policy owners
- Assurance and governance reviewers
- Reliability and analytics teams

## Product outcome

Give a named reviewer enough structured evidence to continue, pause, or roll back a re-entry trial without allowing the application to perform that action.

## Functional requirements

1. Accept exactly one Project 51 report and one bounded assurance request.
2. Reject malformed, unapproved, or unrelated Project 51 lineage.
3. Require a pre-exposure declaration matching approved identity, owner, versions, and scope.
4. Require one shadow stage followed by increasing active exposure.
5. Enforce exposure, dwell, continuity, sample, error, improvement, and incident policies.
6. Require exact corrective-action and contributing-condition coverage in every stage.
7. Verify tested rollback against the recovered baseline and approved recovery time.
8. Require an independent reviewer and named human decision.
9. Preserve evidence and return explainable checks.

## Non-goals

- Changing exposure or configuration
- Activating, promoting, pausing, or rolling back versions
- Editing roadmap estimates
- Replacing experiment statistics
- Assigning blame or evaluating people
- Proving causality or future safety

## Acceptance criteria

- The passing fixture returns `verified_reentry`.
- Every safety gate has a failing test.
- `pause` and `rollback` remain `action_required`.
- The API fails closed without its token and rejects cross-origin requests.
- The complete ProdMind test suite remains green.
