# Product requirements

## Problem

Project 47 can identify a degraded calibration and authorize recalibration, but detection alone does not define how replacement factors should be built or judged. Reusing the same observations for factor construction and acceptance can create an apparently improved proposal that has never been tested on later evidence. Unversioned changes also weaken rollback and auditability.

## Users

- Product operations leaders
- Product managers responsible for roadmap commitments
- Engineering planning leads
- Delivery assurance and governance reviewers

## Job to be done

When Project 47 identifies a deteriorating reference class, create a reviewable replacement proposal that demonstrates bounded improvement on evidence not used to construct it, preserves lineage, and can be reversed before any activation is considered.

## Functional requirements

1. Require an adopted Project 44 calibration and authorized Project 47 candidates.
2. Accept 4–200 newer Project 44 observations with complete evidence lineage.
3. Split every candidate class into earlier training and later holdout observations.
4. Derive candidate duration and capacity factors only from training evidence.
5. Compare active and candidate factors on the untouched holdout.
6. Enforce sample, accuracy, improvement, and change-size policies.
7. Require distinct active and proposed versions with a finite validity period.
8. Require an owned, evidenced rollback to the active version.
9. Require distinct Product, Engineering, and Assurance approvals.
10. Preserve a named human approve, revise, or defer decision.

## Non-goals

- Activating or publishing a factor
- Editing estimates, schedules, scope, staffing, or delivery records
- Optimizing percentile or policy thresholds automatically
- Statistical significance or causal claims
- Performance evaluation of individuals or teams
- Certified cost-estimating or model-risk compliance

## Acceptance criteria

- Candidate factors cannot use holdout observations.
- An insufficient, inaccurate, non-improving, excessive, unapproved, or irreversible proposal cannot be approved.
- All source IDs, factor arithmetic, errors, checks, and reviews are returned.
- The Worker rejects missing secrets, cross-origin calls, unauthenticated calls, non-JSON requests, and oversized bodies.
- The interface is usable in system light and dark modes.
