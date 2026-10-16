# Product requirements

## Problem

Project 46 verifies one completed estimate basis. A factor can pass one review and still degrade as teams, architecture, or delivery conditions change. ProdMind needs a bounded longitudinal control that detects loss of accuracy before a stale calibration becomes standard practice.

## Users and decision

Product operations, engineering planning, finance, and independent assurance review the report. A named reviewer decides to retain the current basis, investigate a signal, or begin a separately governed recalibration process.

## Requirements

1. Accept 3–50 chronological, unique Project 46 reports.
2. Compare non-overlapping baseline and recent report windows.
3. Aggregate duration error, capacity error, and error reduction by declared reference class.
4. Require minimum samples in both windows before evaluating a class.
5. Check assessment cadence, evidence age, and class coverage.
6. Identify evidence-backed recalibration candidates without creating replacement factors.
7. Preserve Project 40, 41, 45, customer, and outcome lineage.
8. Keep retain, investigate, and recalibrate as named human decisions.

## Non-goals

- Statistical process-control certification
- Automatic recalibration or estimate changes
- Causal attribution
- Delivery forecasting
- Employee or team performance scoring
