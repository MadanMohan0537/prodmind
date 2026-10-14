# Architecture

## Components

- `src/controller.js`: pure validation, arithmetic reconciliation, exception controls, checks, and status.
- `src/worker.js`: bounded authenticated HTTP interface and static-asset routing.
- `public/`: upload-and-review interface using the real API.
- Project 7: reconstructs Projects 14 and 40 plus the Project 44 calibration server-side.

## Data flow

1. Validate the approved Project 40 schedule and prior adopted Project 44 report.
2. Match exactly one estimate application to each scheduled item.
3. Resolve its sufficiently sampled reference class.
4. Recalculate duration and capacity from declared bases and applied factors.
5. Compare the applied factors with Project 44 recommendations.
6. Validate a prior independent exception when either factor is lower.
7. Combine freshness, coverage, arithmetic, evidence, and exception checks with a named human decision.

## Trust boundary

The standalone API structurally validates submitted reports but does not independently attest their origin. The connected Project 7 endpoint reconstructs the schedule and calibration from bounded inputs server-side. A production deployment should source historical cases and evidence records from controlled, immutable exports.

Project 45 verifies declared adoption and arithmetic. It does not prove that a base estimate is inherently correct, that a reference class is causal, or that delivery will occur as scheduled.
