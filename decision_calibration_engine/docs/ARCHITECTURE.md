# Architecture

Project 10 reads recent versioned ProdMind runs. It joins Project 6 opportunity confidence to Project 7 decisions and the latest Project 8 monitoring result. Project 9 remains the evidence-retrieval layer; Project 10 adds aggregate judgment feedback.

The implementation is deterministic JavaScript suitable for Cloudflare Workers. It uses no model or external inference service. The connected endpoint reads existing D1 runs; the standalone Worker accepts explicit run exports.

Resolved proxy:

- `sustained → 1`
- `below_target → 0`
- `at_risk → 0`
- `emerging` and `unmonitored → unresolved`

This proxy measures alignment with a declared monitored target. It does not prove that the product decision caused the result.
