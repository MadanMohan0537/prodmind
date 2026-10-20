# Architecture

## Data flow

1. Project 50 supplies verified recovery, restored version, failed version, reference classes, and source IDs.
2. Project 51 validates the incident timeline, conditions, lessons, and corrective actions.
3. Re-entry controls reconcile scope, baseline, new candidate, cooling, shadow, exposure, rollback, and monitors.
4. Independent approvals and a named review produce `ready_for_reentry`, `blocked_reentry`, or `action_required`.

## Components

- `src/learning.js`: side-effect-free deterministic controller
- `src/worker.js`: authenticated Cloudflare Worker boundary
- `public/`: accessible light/dark workbench
- `tests/`: control and HTTP-boundary coverage

## Trust boundary

The standalone endpoint validates the supplied Project 50 report structurally. The connected Project 7 endpoint reconstructs Projects 14 and 40–50 server-side, preventing a client from substituting an unrelated recovery report.
