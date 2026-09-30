# Metrics

| Measure | Definition | Use |
|---|---|---|
| Effort bias rate | `(actual − planned) / planned`, aggregated across reviews | Detect systematic under- or over-estimation |
| Mean absolute effort error rate | Mean of `abs(actual − planned) / planned` | Show typical estimate miss without cancellation |
| On-time rate | Reviews passing Project 30's completion-date check / sample | Assess schedule reliability |
| Effectiveness rate | `verified_effective` reviews / sample | Show how often observed outcomes met the close standard |
| Recurrence rate | Reviews with recurrence evidence or a failed recurrence check / sample | Detect whether addressed conditions returned |
| Observation completeness | Reviews passing the verification-window check / sample | Prevent premature learning |
| Evidence coverage | Reviews with evidence lineage / sample | Prevent unsupported calibration |

All rates are descriptive. Cohorts with no observations remain visible with a sample size of zero. The project does not calculate causal effects, confidence intervals, or employee performance scores.
