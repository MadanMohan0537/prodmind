# Product requirements

## Problem

Project 49 can record a human rollback decision after a recalibration rollout. That decision does not prove that the prior version and factors were actually restored, that recovery finished on time, or that restored estimates remained stable long enough to close the event.

## User and job

Product operations, delivery operations, portfolio leaders, and assurance reviewers need a bounded recovery record before closing an estimate-policy rollback.

## Requirements

- Accept only a matching Project 48 recalibration and Project 49 human rollback decision.
- Require execution after authorization and by the approved owner.
- Reconcile the exact prior version and every pre-recalibration factor.
- Enforce the approved recovery-time limit.
- Require chronological snapshots with bounded cadence and observation duration.
- Verify per-class samples, duration error, capacity error, incidents, and evidence.
- Require a named human close, continue-monitoring, or escalate decision.
- Never execute rollback, edit factors or estimates, or close recovery automatically.

## Non-goals

- Performing deployment or configuration changes
- Establishing causality, statistical significance, or compliance
- Verifying external evidence independently
- Predicting future estimate accuracy

