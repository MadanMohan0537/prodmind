# Product metrics

| Metric | Definition | Guard against |
|---|---|---|
| Lineage resolution rate | Reviews resolving Project 35 → 33 → 32 | Orphan outcome claims |
| Observation coverage | Required observations supplied on cadence | Sparse evidence presented as continuous monitoring |
| Sustainment completion | Reviews completing the declared follow-up window | Premature retention |
| Primary regression rate | Reviews with any post-rollout target failure | Hidden effectiveness drift |
| Guardrail regression rate | Reviews with any post-rollout guardrail failure | Hidden unintended harm |
| Evidence completeness | Observations with a reviewable source | Unsupported decisions |
| Human override rate | Adjust/revert decisions despite passing checks | Treating checks as automated judgment |

Metrics describe workflow quality. They do not prove the policy caused an outcome.
