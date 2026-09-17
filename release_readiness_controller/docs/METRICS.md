# Metrics

| Metric | Definition | Guardrail |
|---|---|---|
| Ready-plan rate | Plans passing every declared check / plans | Readiness is not release success |
| Progressive-rollout coverage | Plans beginning below 100% and ending at 100% / plans | Verify actual traffic separately |
| Rollback completeness | Plans with trigger, owner, procedure and last-known-good version / plans | Documentation must be exercised |
| Rollback decision time | Observed minutes from trigger to decision | Do not infer from the planned maximum |
| Change failure rate | Releases requiring rollback / releases | Segment by release type and exposure |
| Mean time to recovery | Time from detected failure to restored health | Requires real operational telemetry |
