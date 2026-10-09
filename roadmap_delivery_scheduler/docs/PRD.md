# Product requirements

## Problem

ProdMind can select, optimize, stress-test, and rebalance a portfolio, but a selected portfolio is not yet a credible delivery plan. Teams need a reviewable calendar that respects dependencies, scarce capacity, holidays, earliest starts, and deadlines without replacing human estimation or commitment.

## Users

- Product leaders translating portfolio choices into roadmap reviews
- Engineering and design leads declaring capacity and estimates
- Delivery managers checking dependency and deadline feasibility
- Governance reviewers tracing dates back to customer evidence

## MVP requirements

1. Accept only a Project 14 `1.1.0` portfolio report with 1–8 selected items.
2. Require exactly one evidence-backed delivery plan per selected item.
3. Model global and team-specific calendars plus integer team capacity.
4. Reject missing dependencies, cycles, malformed dates, duplicate IDs, and unbounded inputs.
5. Evaluate every dependency-valid priority order and choose by a documented objective.
6. Return dated work, deadline results, team utilization, checks, and dependency-only CPM float.
7. Require a named human `approve`, `revise`, or `defer` decision.
8. Expose authenticated same-origin Worker API and accessible light/dark UI.

## Non-goals

- Selecting, scoring, or rebalancing the portfolio
- Estimating effort or assigning individual people
- Splitting or preempting work
- Monte Carlo schedule-risk analysis or delivery forecasts
- Automatically committing, publishing, or deploying a roadmap

## Acceptance

- Identical valid input produces identical output.
- No approved item violates a declared dependency or team capacity.
- An `approve` decision is blocked if the source is not aligned, evidence is missing, or a deadline is missed.
- Every result explains the objective, search bound, and critical-path limitation.
