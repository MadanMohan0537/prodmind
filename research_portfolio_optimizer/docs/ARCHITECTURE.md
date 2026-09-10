# Architecture

## Standalone

```text
Project 11 report → authenticated Worker → action derivation
                                      → exact optimizer
                                      → portfolio JSON and UI
```

The Worker is stateless. Inputs are bounded by a 2 MB streamed request and a maximum of 16 actions.

## Connected

```text
D1 runs → Project 11 assessEvidenceIntegrity()
        → Project 12 planFromIntegrity()
        → GET /api/research-plan
        → connected workspace
```

Both engines are imported directly by Project 7, so identity contracts do not pass through a second service.

## Solver

The engine enumerates `2ⁿ` action subsets for `n ≤ 16`. A subset is feasible when total effort is within capacity and every dependency is also selected. The objective compares:

1. Higher unique covered priority
2. Lower effort
3. Fewer actions
4. Stable subset order

This produces reproducible output and an exact optimum within the bounded catalog.
