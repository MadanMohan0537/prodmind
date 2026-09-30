# Architecture

```text
Project 30 outcome reviews + declared thresholds + named review
                              ↓
validation → portfolio measures → response cohorts → threshold checks
                              ↓
       calibrated | blocked_acceptance | action_required
```

`src/calibration.js` contains pure deterministic validation and measurement. `src/worker.js` is the Cloudflare Worker boundary: it authenticates API requests, enforces same-origin access and a 2 MB body limit, then delegates to the engine. `public/` is a dependency-free interface that supports the operating-system light/dark preference.

The connected Project 7 endpoint reconstructs Projects 18–30 server-side before calling this engine, so callers cannot replace an upstream intermediate report. Project 31 returns descriptive signals only; a human remains responsible for changing planning policy.
