# Product requirements

## Problem

Project 35 verifies that a planning-policy rollout followed its approved change plan. It cannot show whether the fully deployed policy keeps producing the intended outcome or whether later performance drifts below the predeclared Project 32 target.

## User and decision

Product operations, governance, and planning leaders need evidence for a named `retain`, `adjust`, or `revert` decision after a policy has operated at full exposure.

## Requirements

- Resolve Project 35 rollout lineage back to the Project 33 outcome and Project 32 experiment.
- Reuse predeclared primary targets, guardrails, and minimum sample size.
- Require multiple chronological, evidenced observations after full rollout.
- Check a declared sustainment window and maximum observation gap.
- Verify policy-version continuity and sample sufficiency.
- Expose primary and guardrail regression without claiming causality.
- Block a `retain` decision when any prerequisite fails.
- Never retain, adjust, or revert a policy automatically.

## Non-goals

The MVP does not collect telemetry, infer thresholds, run significance tests, prove causal impact, alter policy, or replace governance review.
