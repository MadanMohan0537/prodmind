# Architecture

## Boundary

The module consumes an approved Project 40 schedule plus human-reviewed delivery snapshots. It performs no network calls and stores no state.

```text
Project 40 baseline ─┐
                     ├─ validation ─ chronology ─ variance calculations
Delivery snapshots ─┘                                │
                                                     ├─ cadence and freshness
                                                     ├─ dependency and deadline checks
                                                     ├─ blocker controls
                                                     └─ named human decision
```

## Calculation model

Each baseline item contains `durationDays × capacity` planned work units. Planned work is time-phased by the schedule’s exact `workDates`. A snapshot declares evidenced completed work units and cumulative consumed capacity-days.

- Schedule variance = earned work − time-phased planned work
- Schedule performance index = earned work ÷ planned work
- Capacity variance = consumed capacity-days − earned work
- Capacity overrun rate = positive capacity variance ÷ total baseline work

These are deterministic descriptive controls. They are not forecasts and do not implement the full EIA-748/DOE EVMS standard.

## HTTP boundary

`src/worker.js` provides health and delivery-monitor routes, constant-work bearer-token comparison, same-origin enforcement, a 2 MB streamed body limit, security headers, structured validation errors, and static asset delivery. The token is a Cloudflare secret and is never returned.

## Trust model

All payloads are untrusted. The engine bounds collections, text, values, dates, states, thresholds, relationships, and chronology. Actual observations cannot decrease or rewrite prior actual dates. The browser renders returned content with `textContent`; no user-supplied HTML is injected.
