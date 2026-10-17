# Product metrics

## Decision-quality metrics

| Metric | Definition | Direction |
| --- | --- | --- |
| Holdout improvement rate | Active mean absolute error minus candidate mean absolute error, separately for duration and capacity | Higher, while positive |
| Candidate holdout error | Mean absolute candidate-factor error against later actual outcomes | Lower |
| Candidate approval rate | Candidate classes passing sample, change, accuracy, and improvement controls / candidate classes | Diagnostic |
| Evidence sufficiency rate | Candidate classes with required training and holdout observations / candidate classes | Higher |
| Rollback readiness rate | Approved proposals with an owned, evidenced rollback to the active version / approved proposals | 100% |
| Independent approval rate | Approved proposals with three distinct approving reviewers / approved proposals | 100% |

## Operational metrics

- Recalibration review completion time
- Proposal expiry rate before a decision
- API validation rejection rate by control
- Revisions per approved proposal
- Later Project 46 effectiveness after activation, measured separately from Project 48

## Interpretation rules

- Holdout improvement is descriptive and sample-dependent.
- Passing thresholds does not establish statistical significance or causal superiority.
- Approval rate is not a productivity target; difficult cases should remain blocked.
- No metric should be used to rank teams or individuals.
- Actual activation and post-activation effectiveness belong to later governed stages.
