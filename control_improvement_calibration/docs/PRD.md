# Product Requirements

## Problem

Project 30 can verify one completed control improvement, but a sequence of verified outcomes does not automatically teach a product organization whether its planning assumptions are reliable. Without an explicit calibration step, effort estimates, delivery expectations, and response choices can remain unchanged even when outcomes repeatedly contradict them.

## User and job

Product, engineering, and governance leaders need a reproducible portfolio view of completed improvements so they can decide whether to accept a planning baseline, adjust planning policy, or collect more evidence.

## Requirements

- Accept a versioned Project 30 report containing 1–100 reviews.
- Measure effort bias, absolute effort error, on-time delivery, observed effectiveness, recurrence, observation completeness, and evidence coverage.
- Show the same measures for `prevent`, `detect`, and `govern` cohorts.
- Evaluate explicit, caller-supplied thresholds and a minimum sample size.
- Require a named human review and preserve its rationale and timestamp.
- Return `calibrated`, `blocked_acceptance`, or `action_required` deterministically.
- Authenticate non-health endpoints, reject cross-origin API calls, cap JSON bodies at 2 MB, and serve a responsive light/dark interface.

## Non-goals

- Automatically changing future estimates, schedules, or Project 29 priorities.
- Ranking individuals or teams.
- Claiming that an improvement caused an observed outcome.
- Replacing statistical inference, audit, compliance review, or management judgment.

## Acceptance

The same valid input always produces the same report. An `accept_baseline` decision is blocked if any declared threshold, minimum sample, observation, or evidence check fails. Alternative human decisions remain action-required.
