# Architecture

`src/benefits.js` is the dependency-free domain engine. It resolves selected opportunities from ProdMind runs, validates benefit profiles, calculates progress, and returns lineage-rich results.

`src/worker.js` exposes the standalone authenticated Worker. It fails closed without `API_TOKEN`, streams and bounds JSON bodies, and serves static assets through the Workers assets binding.

Project 7 imports the same domain function. Its connected endpoint loads recent versioned runs from D1 before calculation; no result is persisted and no ranking is mutated.

## Trust boundary

Inputs are reviewed declarations. Dates and numbers are validated, but source-system accuracy and causal attribution remain human responsibilities. Aggregates are partitioned by the exact unit string.
