# Product requirements

## Problem

An opportunity-level alignment score does not show whether the selected portfolio reflects the organization’s strategy. Teams need a reviewable connection between strategic objectives, selected work, delivery effort, and source evidence.

## Users

Product leaders, portfolio managers, product managers, and finance or strategy partners reviewing a delivery portfolio.

## Jobs

1. Declare objectives and intended capacity ranges.
2. Map selected opportunities to primary objectives.
3. Compare actual effort allocation with the declared strategy.
4. Identify unmapped work and allocation exceptions.
5. Trace each portfolio item back to its evidence.

## Acceptance criteria

- Accept 1–20 objectives whose target shares total 1.
- Accept at most 500 unique opportunity mappings.
- Analyze only selected Project 6 opportunities.
- Weight actual allocation by explicit effort.
- Preserve run, opportunity, and evidence identity.
- Reject ambiguous cross-run opportunity-only mappings and accept `runId` or canonical `portfolioItemId`.
- Report unmapped selected work.
- Handle empty portfolios without false alerts.
- Never mutate a ranking or strategy.
- Fail closed without API authentication.

## Non-goals

- Strategy generation
- Roadmap optimization
- Financial forecasting
- Benefits realization claims
- Automatic portfolio changes
- Multi-tenant governance
