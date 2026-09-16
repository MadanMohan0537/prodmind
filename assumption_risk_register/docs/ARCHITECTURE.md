# Architecture

`src/assumptions.js` is a dependency-free engine. It derives selected portfolio items from ProdMind runs, validates all client-supplied identity links, calculates a disclosed exposure heuristic, and returns both the full ledger and unresolved validation queue.

`src/worker.js` exposes the standalone authenticated API. Project 7 imports the same engine and supplies recent versioned D1 runs. Results are calculated on request and never modify rankings, experiments, benefits, or assurance decisions.

The design intentionally keeps uncertainty as a declared human input. Evidence links establish traceability, not truth or causal validity.
