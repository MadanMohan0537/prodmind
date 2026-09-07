# Architecture

Project 9 consumes complete, server-owned Product 7 run snapshots after Projects 1–8 have added their evidence and outcomes. `buildLearningMemory` creates bounded decision cards. `searchLearningMemory` performs deterministic weighted token matching across opportunity, hypothesis, metric, rationale and evidence fields.

The connected Worker reads recent runs directly from its existing D1 binding. The standalone Worker accepts explicit run exports. Neither path copies data to a third-party service or requires an embedding API.

Identity flow:

`runId → opportunityId → experimentId → decisionId → monitorId`, with `evidenceIds` retained on every card.
