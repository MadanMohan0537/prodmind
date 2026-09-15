# Architecture

`src/assurance.js` is a dependency-free rules engine. It resolves canonical selected portfolio items, joins Project 16 benefits, evaluates transparent completeness checks, validates the human decision, and returns action status.

`src/worker.js` provides the standalone authenticated API. Project 7 imports both Project 16 and Project 17 engines: it creates the benefit report from recent D1 runs, then passes the same authoritative runs and report to the assurance engine.

No assurance output is automatically persisted or allowed to mutate a run. This keeps the first version reviewable and avoids implying that a generated completeness status is organizational approval.
