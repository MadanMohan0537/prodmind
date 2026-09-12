# Architecture

## Standalone

```text
Runs + strategy + options → authenticated Worker
                          → exact rebalance engine
                          → scenario API and frontend
```

## Connected

```text
D1 product_runs → Project 7 RunStore.recent()
                + strategy and scenario options
                → rebalancePortfolio()
                → POST /api/portfolio-rebalance
```

The connected route imports the engine directly and returns a simulation. It does not call `RunStore.save`.

## Search bound

With `n ≤ 18`, the engine evaluates `2ⁿ` subsets. It filters subsets by capacity, locks, mappings, and dependencies, computes objective allocation, then applies deterministic lexicographic comparison.

The design favors an inspectable exact baseline over an unverified heuristic. A future large-catalog version could replace enumeration with CP-SAT while retaining the same contracts and tests.
