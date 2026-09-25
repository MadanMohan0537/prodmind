# Metrics

| Metric | Definition | Guardrail |
|---|---|---|
| Active exception count | Approved, unexpired exceptions | Never treat as resolved controls |
| Blocked approval rate | Approval requests failing a required check | Review policy fit and input quality |
| Expired active rate | Exceptions past expiry / approved exceptions | Expiry must never auto-renew |
| Remediation linkage | Active exceptions with an open remediation obligation / active exceptions | Link quality needs human review |
| Median exception age | Days since request among active exceptions | Segment by risk, not employee |
| Closure integrity | Closures where the target is no longer failing / closure attempts | Never reward premature closure |

Track repeated exceptions against the same target separately; recurrence may indicate a structural control problem.
