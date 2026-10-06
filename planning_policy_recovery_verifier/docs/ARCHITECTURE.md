# Architecture

## Components

| Component | Responsibility |
|---|---|
| `src/recovery.js` | Validate lineage and deterministically assess reversion and recovery |
| `src/worker.js` | Authenticate, bound, parse, and route HTTP requests |
| `public/` | Accessible light/dark evidence-review interface |
| Project 7 adapter | Reconstruct Projects 18–36 before invoking this engine |

## Trust boundaries

Input evidence is untrusted. The Worker requires a bearer secret, enforces same-origin API calls, accepts only JSON, and limits bodies to 2 MB. The engine rejects missing lineage, unordered observations, duplicate identities, missing monitor coverage, and invalid decision timestamps.

The engine's output is an assurance record, not an instruction to infrastructure. Execution and policy authority remain external.

## Data flow

Project 36 identifies a human `revert` decision. Project 35 supplies the original approved rollback target, SLA, scope, and recovery monitors. Execution snapshots demonstrate rollout reversal; subsequent observations demonstrate stability. The engine returns explicit checks plus preserved lineage for human review.
