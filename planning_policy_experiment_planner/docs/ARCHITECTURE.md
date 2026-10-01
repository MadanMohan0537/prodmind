# Architecture

```text
Project 31 failed calibration checks + candidate reversible trials
                              ↓
validation → gap weights → dependency graph → exact subset search
                              ↓
        approved | blocked_approval | action_required | no_gaps
                              ↓
             named human policy-experiment decision
```

`src/planner.js` is a pure deterministic engine. It examines at most 16 candidates, so the exhaustive search evaluates no more than 65,536 subsets. It maximizes unique calibration-gap coverage, then minimizes effort and experiment count.

`src/worker.js` is the Cloudflare Worker boundary. It uses a secret binding, fixed-size digest comparison, same-origin enforcement, streamed request reading with a 2 MB cap, explicit error responses, and static assets. It has no mutable request state or paid dependency.

The connected Project 7 endpoint reconstructs Projects 18–31 server-side before invoking Project 32. Historical outcome-review IDs pass through Project 31 into the plan. No client can substitute the current calibration report on the connected route.
