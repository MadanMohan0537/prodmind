# Architecture

## Data flow

1. Project 48 supplies the approved version, exact candidate factors, expiry, and rollback limit.
2. The rollout declaration pins the baseline and target before observation begins.
3. A shadow stage evaluates the candidate without active exposure.
4. Active stages increase exposure and retain paired baseline/candidate observations.
5. The pure engine computes sample-weighted class metrics and deterministic checks.
6. A named reviewer records `promote`, `pause`, or `rollback`.

## Components

- `src/monitor.js`: side-effect-free validation and assurance engine
- `src/worker.js`: authenticated same-origin Cloudflare Worker adapter
- `public/`: responsive light/dark API workbench
- `tests/`: engine and HTTP-boundary coverage

## Trust boundary

The API trusts no client-side status. It reconstructs every outcome from the Project 48 report and rollout evidence. The standalone Worker requires a bearer secret, rejects cross-origin API calls, caps bodies at 2 MB, and applies restrictive response headers. The engine records evidence; it does not independently verify external systems.

## Deployment

Cloudflare serves static assets and executes the Worker. No database or paid inference service is required. Upstream systems remain the systems of record.

