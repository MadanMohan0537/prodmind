# Metrics

## Product metrics

- journey completion rate;
- conversion from each stage to the next;
- median time from first stage to final value stage;
- sufficiently large segment completion rate;
- invalid-user rate caused by ordering or segment-quality defects.

## System quality metrics

- reports with intact Project 19 lineage;
- rejected malformed-event rate;
- suppressed small-cohort rate;
- deterministic replay consistency;
- analysis latency at the documented event limit.

## Interpretation rules

- Use counts beside rates and inspect instrumentation changes before interpreting movement.
- Do not compare segments whose metrics are suppressed.
- Do not treat a funnel association as a causal effect.
- Define stages before reviewing results; changing definitions after inspection creates analysis flexibility.
- Track event coverage and duplicate rejection as data-quality signals, not adoption outcomes.
