# Product metrics

## Decision quality

- **Feasible approval rate:** approved schedules divided by approval requests.
- **Deadline conflict rate:** selected items that miss a declared deadline in the optimum.
- **Dependency violation rate:** must remain zero for emitted schedules.
- **Evidence coverage:** scheduled items retaining at least one customer-evidence ID; approval requires 100%.

## Planning quality

- **Schedule revision rate:** reviews ending in `revise` divided by completed reviews.
- **Estimate calibration:** actual capacity-days divided by planned capacity-days, measured outside this stateless MVP.
- **Date calibration:** absolute actual-versus-planned finish-day error, measured after delivery.
- **Portfolio-to-plan time:** time from Project 14 alignment to named schedule review.

## Operational health

- API validation failure rate
- p50/p95 execution time by item count
- evaluated-order count by request
- maximum-horizon rejection rate

## Guardrails

- Never describe `optimalWithinBounds` as delivery certainty.
- Never treat dependency-only float as resource-aware schedule risk.
- Never approve without a named reviewer and retained evidence lineage.
- Review the eight-item exact-search limit before increasing it.
