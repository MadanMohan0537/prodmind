# Product requirements

## Problem

A portfolio can fit today's capacity and strategy yet fail under plausible operating changes. Product leaders need to see which commitments, dependencies, and objective allocations are fragile before accepting a roadmap scenario.

## Decision

Determine whether a selected or proposed portfolio is resilient across explicitly declared stress scenarios and identify the weakest scenario and evidence-linked items at risk.

## Acceptance criteria

- Read selected Project 6 items or explicit canonical portfolio IDs.
- Preserve run, opportunity, dependency, objective, and evidence identity.
- Accept 1–12 named scenarios and at most 100 selected items.
- Model capacity factors, unavailable items, and bounded effort multipliers.
- Detect capacity overrun, dependency failure, and strategic range drift.
- Return deterministic scenario scores, status, weakest scenario, and at-risk items.
- Reject ambiguous cross-run mappings.
- Never invent probabilities or mutate a saved ranking.

## Non-goals

- Forecasting the probability of a scenario
- Automatic roadmap changes
- Team scheduling or financial valuation
- Causal impact estimation
- Enterprise Monte Carlo simulation
