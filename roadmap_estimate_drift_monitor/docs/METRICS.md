# Metrics

For each reference class and dimension:

`window error = arithmetic mean of Project 46 calibrated error rates`

`error increase = recent window error - baseline window error`

A class is evaluable only when both windows meet `minimumItemsPerClass`.

## Stability conditions

- Recent duration error is within the maximum duration-error policy.
- Recent capacity error is within the maximum capacity-error policy.
- Neither error increase exceeds the maximum allowed increase.
- Recent duration and capacity error reductions both meet the minimum improvement policy.

## Portfolio checks

- Sufficient, non-overlapping history
- Assessment cadence and latest-report age
- Reference-class sample coverage
- Duration stability
- Capacity stability
- Error-reduction retention
- Complete source and evidence lineage

These are transparent operating-policy checks. They are not confidence intervals, hypothesis tests, control limits, forecasts, or people metrics.
