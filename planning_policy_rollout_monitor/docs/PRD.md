# Product requirements

## Problem

Project 34 verifies that a planning-policy change is safe to activate, but readiness does not prove that the human-executed rollout followed its approved stages or stayed within operational thresholds.

## Requirements

- Accept only a real Project 34 change proposal.
- Preserve Project 33 outcome and Project 34 change identities.
- Reconcile every approved rollout percentage in chronological order.
- Enforce the minimum observation period at each stage.
- Verify the approved policy version in every snapshot.
- Evaluate every declared monitor against its threshold.
- Require evidence for each stage and a named continue, pause, or rollback decision.
- Never change rollout state automatically.

## Non-goals

This project does not activate policies, collect telemetry, automate rollback, establish causality, or evaluate employee performance.

