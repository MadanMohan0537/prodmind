# Architecture

## Standalone path

```text
Runs + strategy JSON → authenticated Worker
                     → alignment engine
                     → allocation audit and frontend
```

The standalone Worker is stateless and accepts a bounded 2 MB JSON request.

## Connected path

```text
D1 product_runs → RunStore.recent()
                + reviewed strategy body
                → auditStrategyAlignment()
                → POST /api/strategy-audit
```

Project 7 imports the engine directly. The API uses the workspace’s existing bearer authentication, same-origin enforcement, and D1 fail-closed behavior.

## Data boundary

Strategy mappings refer to server-owned opportunity IDs. The engine reads selected opportunities from the saved Project 6 portfolio and retains evidence IDs in the result. It never edits saved runs.
