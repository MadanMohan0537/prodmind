# Architecture

## Components

- `src/calibration.js`: pure validation, observation normalization, deterministic grouping, percentile calculations, checks, and status.
- `src/worker.js`: bounded authenticated HTTP interface and static-asset routing.
- `public/`: upload-and-review interface using the real API.
- Project 7: reconstructs the current Projects 14, 40, and 41 case and supplies validated historical cases.

## Data flow

1. Validate each approved schedule and matching delivery report.
2. Require complete actuals and exact reference-class coverage.
3. Calculate planned and actual elapsed duration and capacity ratios.
4. Group observations by the explicitly declared reference class.
5. Calculate medians, nearest-rank percentiles, absolute error, and on-time rate.
6. Withhold factors where sample-size or freshness checks fail.
7. Reconcile the checks with a named human decision.

## Trust boundary

The connected endpoint reconstructs the current case from Project 7 inputs. Historical cases are client-supplied records whose internal Project 40–41 lineage is validated; the deployment does not independently attest their origin. Use a controlled evidence-export process for production inputs.
