# Metrics

## Product metrics

- Verified-effective actions / reviewed actions
- Actions blocked for insufficient follow-up or observation time
- Later recurrence rate after improvement completion
- Median planned-versus-actual effort variance
- Time from completion to reviewed outcome

## Quality metrics

- Evidence-lineage preservation (target: 100%)
- Unknown-action rejection rate
- Close decisions blocked by failed checks
- Deterministic replay agreement (target: 100%)

## Guardrails

Do not infer causality from before/after observations, reward lower recurrence counts obtained by weaker monitoring, or use effort variance to evaluate individuals. A `verified_effective` result means the declared checks passed for the supplied window; it is not a guarantee of future performance.

