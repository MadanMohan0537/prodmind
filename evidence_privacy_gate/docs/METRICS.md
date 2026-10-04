# Metrics: Product Evidence Privacy Gate

| Metric | Definition | Why it matters |
| --- | --- | --- |
| Raw-value leakage | Count of raw detected values present in persisted artifacts (target: 0, verified by a test that searches scan output) | The gate exists to make this zero |
| Blocked-batch rate | Batches with `decision_required` ÷ total batches | Signals whether sources are sending consequence-sensitive data |
| Findings per 1,000 records by type | From `summary.byType` | Shows which sources need upstream pseudonymization |
| Decision latency | Time from `decision_required` to recorded decision | Governance responsiveness |
| Admit-after-redaction share | `admit_redacted` ÷ decisions | Whether redaction is sufficient in practice |
| Detector precision on a labelled sample | Manual monthly review of 50 findings | Keeps false positives from eroding trust |

None of these measures reward automatic admission. A rising blocked-batch rate
is a prompt to fix the source, not to loosen the policy.
