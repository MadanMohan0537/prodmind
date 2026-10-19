# Architecture

## Data flow

1. Project 48 supplies the approved active and candidate versions plus pre-change factors.
2. Project 49 supplies the matching named rollback decision, owner, target, and recovery limit.
3. Execution evidence records authorization, completion, versions, owner, and elapsed recovery time.
4. Factor restorations reconcile every reference class to its exact prior values.
5. Recovery snapshots provide chronological accuracy, sample, incident, and evidence observations.
6. The pure engine evaluates deterministic gates before a named human closeout decision.

## Components

- `src/verifier.js`: side-effect-free validation and recovery engine
- `src/worker.js`: authenticated same-origin Cloudflare Worker adapter
- `public/`: responsive light/dark API workbench
- `tests/`: recovery and HTTP-boundary coverage

## Trust boundary

The standalone API rejects untrusted origins, requires a bearer secret, caps bodies at 2 MB, and emits restrictive response headers. The connected endpoint reconstructs Projects 14 and 40–49 server-side. Evidence is validated structurally but remains externally supplied.

