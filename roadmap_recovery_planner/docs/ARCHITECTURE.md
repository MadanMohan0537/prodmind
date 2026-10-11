# Architecture

## Boundary

```text
Project 40 baseline ─┐
                     ├─ lineage and target validation
Project 41 variance ─┘              │
                                    ├─ candidate validation
Recovery candidates ────────────────┤
                                    ├─ exact bounded selection
                                    └─ named human review
```

The module is stateless and performs no network calls. Project 7 reconstructs the source reports server-side before invoking it.

## Selection objective

All non-empty subsets of at most 16 candidates are evaluated. Subsets exceeding declared capacity or omitting a selected action's prerequisite are infeasible. Feasible sets are ordered by:

1. maximum unique severity-weighted failed-control coverage;
2. fewest baseline-changing actions;
3. fewest irreversible actions;
4. lowest effort;
5. earliest latest due date;
6. fewest actions.

This is deterministic decision support. Severity weights are visible product policy, not risk probabilities.

## HTTP and trust boundary

`src/worker.js` implements constant-work bearer-token checking, same-origin enforcement, a streamed 2 MB body limit, structured errors, security headers, and static-asset delivery. Inputs are bounded and validated before exact search. The browser uses `textContent` for returned values.
