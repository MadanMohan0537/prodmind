# Product requirements

## Problem

Project 53 can declare a retried calibration candidate ready for promotion, but readiness does not prove the later activation used the authorized version, reached the intended scope, or remained healthy after full adoption.

## Decision

Product, delivery, operations, and assurance reviewers decide whether to retain the promoted baseline, extend monitoring, or rollback. The software never activates or reverts a version.

## Requirements

- Preserve exact Project 53 authorization and version lineage.
- Verify execution timing, owner, prior version, and promoted version.
- Require chronological post-activation snapshots and full final adoption.
- Aggregate paired accuracy by reference class without hiding failures.
- Enforce samples, error, improvement, incident, control, recurrence, and rollback gates.
- Require an independent named review.
- Run on Cloudflare Workers without paid services.
