# Metrics

| Metric | Definition | Guardrail |
|---|---|---|
| Current-pack rate | Monitors with status `current` / all monitors | Never interpret as legal compliance |
| Overdue-obligation rate | Open obligations past due / open obligations | Track by owner, not as employee ranking |
| Digest continuity | Packs whose observed and authoritative digests match | A match is not a signature |
| Review timeliness | Reviews completed by calculated next-review date | Preserve approved exceptions |
| Evidence completeness | Completed or waived obligations with evidence / completed or waived | Review evidence quality manually |
| Mean remediation age | Days from failed check to reviewed resolution | Do not auto-close actions |

Measure false alerts and reviewer overrides before using the monitor for operational escalation.
