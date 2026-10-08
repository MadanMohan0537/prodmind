# Architecture

## Components

- `src/assurance.js` — pure validation and deterministic assurance engine
- `src/worker.js` — authenticated same-origin HTTP boundary with bounded streaming JSON parsing
- `public/` — static upload UI with native light/dark behavior
- `tests/` — engine boundaries and Worker security behavior
- Project 7 — server-side reconstruction of Projects 18–38 before Project 39 assessment

## Trust boundary

The client supplies evidence. The Worker validates shape, bounds, chronology, lineage, coverage, and thresholds; it does not verify the external truth of evidence. Authentication is a shared bearer secret and is suitable only with normal secret rotation and access controls.

## Data flow

1. Validate the versioned Project 38 report and evaluation policy.
2. Join each trial to exactly one ready incident-learning review.
3. Validate the declaration, approval boundary, stages, executions, observations, metrics, and action-control evidence.
4. Evaluate nine named checks.
5. Combine those checks with the named human decision.
6. Return a versioned, auditable report without mutating external state.

## Runtime

The engine uses standard JavaScript only. It is deterministic, stateless, and compatible with Cloudflare Workers. Static assets share the Worker origin; no CDN script or paid service is required.

