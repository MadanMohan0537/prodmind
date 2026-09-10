# Architecture

## Standalone path

```text
Browser → authenticated Worker → integrity engine → JSON report
```

The standalone Worker accepts bounded run exports and keeps no server-side state. Static assets and API traffic share one Cloudflare Worker deployment.

## Connected path

```text
D1 product_runs → Project 7 RunStore.recent()
                → assessEvidenceIntegrity()
                → GET /api/evidence-integrity
                → Project 7 evidence-quality view
```

Project 7 imports `src/integrity.js` directly. No network hop or duplicate algorithm is introduced. The connected endpoint uses the workspace bearer-token and same-origin controls.

## Trust boundary

The engine trusts only server-owned opportunity-to-evidence links on the connected path. It reports missing IDs as blockers. It does not mutate runs or rankings.

## Complexity and bounds

At most 50 runs are accepted. Each opportunity is assessed against its run-local evidence map. The repository’s existing run limit keeps work bounded for Cloudflare execution.
