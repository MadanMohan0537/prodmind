# Product requirements

## Problem

Product teams record confidence before prioritization but rarely compare those estimates with resolved outcomes. Without feedback on forecasting behavior, persistent overconfidence or underconfidence remains invisible.

## MVP outcome

A PM can inspect Brier score, confidence bias, reliability bins, unresolved decisions, and the exact opportunities and evidence behind the calculation.

## Requirements

- Read Project 6 confidence from evidence-linked opportunities.
- Resolve outcomes only from Project 8 statuses: sustained is 1; below-target or at-risk is 0.
- Keep emerging and unmonitored decisions unresolved.
- Preserve run, opportunity, experiment, decision, monitor, and evidence identifiers.
- Report Brier score and calibration bins separately.
- Warn when fewer than 20 resolved decisions are available.
- Never automatically rewrite Project 6 confidence or scoring weights.

## Non-goals

Causal attribution, automatic recalibration, team performance ranking, employee evaluation, and significance testing are not part of the MVP.
