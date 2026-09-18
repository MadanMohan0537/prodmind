# Architecture

1. Project 7 loads persisted product runs.
2. Project 18 reconstructs the assumption report.
3. Project 19 reconstructs release readiness and lineage.
4. Project 20 validates journey definitions and pseudonymous events.
5. Events are sorted; the first occurrence of each stage is retained per user.
6. Users with segment changes or contradictory stage order are excluded and counted.
7. Funnel, time-to-value, and privacy-suppressed segment metrics are returned.

## Trust boundaries

- Bearer authentication, same-origin enforcement in Project 7, 2 MB request limits, no-store responses, and restrictive browser headers protect the HTTP surface.
- The engine receives snapshots; it does not access analytics vendors or retain events.
- `userId` is an opaque pseudonym. Deployers remain responsible for consent, minimization, retention, deletion, and access controls.
- Segment results below `minSegmentSize` omit completion counts and rates.

## Complexity

Journey events are bounded at 10,000 and journeys at 20. Sorting dominates at `O(e log e)` per journey; remaining aggregation is deterministic in-memory work suitable for bounded Worker requests.

## Integration contract

`releaseId` joins to Project 19. That report supplies `portfolioItemId`, `evidenceIds`, `shipDecisionIds`, `assumptionIds`, version, title, and readiness status. Project 20 never accepts caller-supplied substitutes for those lineage fields.
