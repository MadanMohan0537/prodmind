# Architecture

## Flow

```text
Project 51 approved learning and re-entry plan
                    ↓
Pre-exposure declaration and Project 52 policy
                    ↓
Shadow stage → bounded active stages
                    ↓
Paired class outcomes + action controls + recurrence signals
                    ↓
Incident and rollback checks
                    ↓
Human continue | pause | rollback decision
```

## Components

- `src/assurance.js` is a pure deterministic module with no I/O.
- `src/worker.js` provides the authenticated Cloudflare Worker boundary.
- `public/` contains a dependency-free responsive workbench.
- `tests/` covers the engine boundary and Worker security behavior.
- Project 7 reconstructs the preceding connected reports instead of trusting client-supplied upstream lineage.

## Trust boundaries

- Evidence text and metric values are reviewed inputs, not independently verified facts.
- The bearer token is appropriate only for a small trusted deployment.
- Same-origin enforcement blocks browser calls from unapproved origins.
- The 2 MB streaming cap bounds request memory before parsing.
- Outputs use `no-store`, strict CSP, MIME protection, and no-referrer headers.

## Determinism

The same normalized Project 51 report, policy, stage evidence, and human review produce the same result. No model, randomness, paid service, or network dependency participates in assessment.
