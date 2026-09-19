# Architecture

Project 7 reconstructs assumption risk, release readiness, and adoption before invoking this engine. `journeyId` is the only join supplied by a lifecycle plan; release, opportunity, evidence, decision, assumption, and observed-adoption fields come from the authoritative Project 20 result.

The deterministic engine normalizes dates and bounded collections, applies action-specific checks, and returns every check with its evidence. It is stateless and does not call external systems.

## Trust boundaries

- Bearer authentication, same-origin enforcement in Project 7, no-store responses, restrictive browser headers, and a 2 MB limit protect the HTTP surface.
- Approval records document supplied human review; they are not cryptographic signatures.
- Dependency and communication status are declarations and require operational verification.
- No endpoint sends communication, changes traffic, disables features, or deletes data.
