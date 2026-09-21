# Architecture

`reviewSunsetOutcomes()` is a pure deterministic engine. It joins each review to a Project 22 snapshot, validates bounded inputs, computes transparent checks, preserves identity lineage, and emits an immutable report.

The standalone Worker exposes one authenticated JSON route. The Project 7 host reconstructs Projects 18–22 before invoking the same engine, preventing callers from replacing authoritative upstream links.

No storage or paid service is required by the standalone calculation. Cloudflare Assets serves the demonstration UI.
