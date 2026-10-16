# Architecture

## Data flow

1. Project 46 reports provide completed-outcome accuracy, error reduction, reference classes, and evidence lineage.
2. The monitor validates strict chronology, unique report identities, and bounded item contracts.
3. The earliest declared reports form the baseline window; the latest declared reports form the recent window. The windows cannot overlap.
4. Per-class aggregates compare recent error with baseline error and declared tolerances.
5. Cadence, evidence age, sample coverage, accuracy, and retained improvement become explicit checks.
6. A named human review produces the final status.

## Components

- `src/monitor.js`: deterministic validation, windowing, aggregation, and controls
- `src/worker.js`: authenticated Cloudflare Worker adapter with bounded JSON input
- `public/`: responsive light/dark demonstration interface
- `tests/`: engine and security-boundary tests

## Trust boundaries

The standalone Worker rejects missing configuration, invalid bearer tokens, cross-origin API calls, non-JSON bodies, and bodies over 2 MB. The connected Project 7 endpoint reconstructs the latest Project 46 assessment server-side and accepts historical assessments as explicitly supplied evidence.

## Limitations

The policy thresholds are not statistically derived control limits. Small samples can hide or exaggerate change, so minimum sample coverage is explicit and unevaluable classes remain visible. Aggregated change does not identify a root cause or prove that calibration caused an outcome.
