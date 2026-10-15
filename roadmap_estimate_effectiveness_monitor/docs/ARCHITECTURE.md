# Architecture

## Data flow

1. Project 40 supplies the approved schedule, item IDs, and customer evidence.
2. Project 41 supplies completed delivery status and actual capacity-days.
3. Project 45 supplies base and calibrated estimates plus governed exceptions.
4. A reviewer supplies actual active workdays and supporting evidence because calendar elapsed days and planned workdays are not interchangeable.
5. The pure monitor calculates comparable absolute percentage errors and error reductions.
6. Policy checks and a named human decision produce the report status.

## Components

- `src/monitor.js`: deterministic validation, comparison, checks, and report assembly
- `src/worker.js`: authenticated, bounded Cloudflare Worker adapter
- `public/`: responsive same-origin demonstration UI with native light/dark themes
- `tests/`: pure-engine and Worker-boundary coverage

## Trust boundaries

The Worker rejects cross-origin API requests, missing configuration, invalid bearer tokens, non-JSON bodies, and bodies over 2 MB. The token is a deployment secret and is never committed. The health endpoint exposes only configuration state.

The monitor accepts reviewed actual workdays rather than deriving them from timestamps. This prevents a silent unit mismatch between Project 40 workdays and Project 41 calendar elapsed time. The evidence field makes that human-reviewed input auditable.

## Limitations

Absolute percentage error becomes sensitive when actual values are small. The bounded MVP does not calculate statistical significance, confidence intervals, or reference-class heterogeneity. A better observed outcome does not prove that calibration caused it.
