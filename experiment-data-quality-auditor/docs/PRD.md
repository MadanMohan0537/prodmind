# Product requirements: Experiment Data Quality Auditor

## User and problem

PMs and product analysts may receive apparently valid conversion totals built from inconsistent event logs. This product provides a reproducible upstream gate before statistical interpretation.

## MVP contract

Input: one experiment, two variants, pseudonymous user IDs, exposure and conversion events. Output: a versioned diagnostic report and, only if all implemented checks pass, unique-user counts for each arm.

## Acceptance criteria

- Known duplicate, crossover, orphan and time-order defects block aggregate output.
- Event order does not affect valid aggregates.
- Repeated legitimate events never multiply unique users or binary converters.
- Both variants must have exposure records.
- API authentication fails closed; oversized bodies are rejected while streaming.
- Raw user IDs are absent from reports.
- No external model or service is needed to run checks.

## Quality metrics

Measure seeded-defect detection rate, clean-fixture false-block rate, aggregate correctness, and deterministic repeatability. Unit tests establish behavior on fixtures, not performance on real customer datasets. No field-accuracy claims are made.

## Architecture

CLI and Worker both invoke the same pure audit function. Runtime checks enforce the contract rather than relying on an unused schema file. The engine builds first-exposure indexes per user and variant, then checks conversions against those indexes. It never edits its input. Reports reference original 1-based row numbers; findings without a single offending row use null.

## Risks

Incomplete extraction can resemble invalid instrumentation. User identity changes may resemble orphan conversions. Different conversion definitions cannot be merged. Review reporting boundaries and extraction rules before using the gate. Passing these checks is necessary only under this product's policy, never sufficient for causal validity.
