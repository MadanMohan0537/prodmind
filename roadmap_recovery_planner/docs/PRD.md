# Product requirements

## Problem

Project 41 exposes roadmap-delivery variance, but detection alone does not create an accountable response. Teams need to compare bounded corrective-action proposals without overwriting the Project 40 baseline or pretending that a selected action has already changed delivery.

## Users

- Product and portfolio leaders
- Delivery managers
- Engineering and design leads
- Governance and investment councils

## MVP requirements

1. Accept matching Project 40 and Project 41 reports.
2. Derive eligible targets only from failed Project 41 controls.
3. Accept at most 16 owned, evidenced recovery candidates with dates, effort, exit criteria, affected work, dependencies, reversibility, and baseline-change declarations.
4. Reject unknown work, duplicate identities, cycles, incompatible action types, and invented targets.
5. Search every non-empty candidate subset while enforcing capacity and action dependencies.
6. Maximize unique severity-weighted failed-control coverage, then minimize baseline changes, irreversible actions, effort, due date, and action count.
7. Preserve original customer-evidence lineage.
8. Require a named approve, revise, or defer review.
9. Expose an authenticated same-origin Cloudflare Worker API and responsive light/dark frontend.

## Non-goals

- Editing or rebaselining the roadmap
- Assigning people or changing team capacity
- Changing scope, deadlines, blockers, or work state
- Predicting completion probability
- Claiming root cause, causal impact, GAO compliance, or certified EVMS corrective action

## Acceptance

- Identical input produces identical output.
- Approval is blocked below the declared failed-control coverage threshold.
- Every selected action remains linked to Projects 40–41, affected work, and original evidence.
- Results clearly distinguish planning evidence from executed change.
