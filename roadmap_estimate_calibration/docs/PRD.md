# Product requirements

## Problem

ProdMind can schedule work, monitor actual delivery, plan recovery, and verify recovery. It does not yet convert completed delivery evidence into better estimating context. Teams can therefore repeat optimistic duration and capacity assumptions without seeing their historical error.

## Outcome

Provide an evidence-linked, reviewable reference-class calibration report for future Project 40 planning.

## Users

Product leaders, delivery leads, engineering managers, portfolio analysts, and governance reviewers.

## Functional requirements

- Validate matching, completed Project 40–41 cases.
- Require explicit comparable-work classifications and their basis.
- Calculate duration and capacity error per item.
- Aggregate medians and configurable nearest-rank percentiles.
- Withhold recommendations from undersized or stale classes.
- Preserve source identities and evidence.
- Require a named adopt, revise, or defer review.
- Run on Cloudflare Workers without paid services.

## Non-goals

Automated estimation, employee evaluation, causal attribution, delivery prediction, probabilistic schedule-risk analysis, or mutation of saved schedules.
