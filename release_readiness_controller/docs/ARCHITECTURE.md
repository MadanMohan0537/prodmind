# Architecture

`src/readiness.js` is a dependency-free policy engine. It joins selected opportunities and human decisions from ProdMind runs with a Project 18 assumption report, validates each release plan, and returns explicit checks.

`src/worker.js` provides the standalone authenticated API. Project 7 builds the assumption report from authoritative D1-backed runs and then supplies both to Project 19. The output is stateless and cannot mutate traffic or deployment systems.

This separation keeps release policy testable while preventing a portfolio application from silently acquiring production-control privileges.
