# Architecture

## Boundary

The module consumes Project 14 output plus human-declared scheduling inputs. It does not call external services and does not persist data.

```text
Project 14 portfolio ─┐
                     ├─ validation ─ dependency DAG ─ exact order search
Calendars and plans ─┘                              │
                                                    ├─ earliest placement
                                                    ├─ objective ranking
                                                    └─ checks and human decision
```

## Engine

`src/scheduler.js` normalizes bounded inputs, proves the dependency graph acyclic, enumerates topological orders, and places each item on the earliest team workdays with enough capacity. The comparator minimizes:

1. missed deadline count;
2. total lateness days;
3. makespan;
4. lexical priority order as a deterministic tie-break.

The eight-item limit makes exhaustive search explicit. `optimalWithinBounds` means only that every dependency-valid order inside this model was evaluated; it does not mean the estimates or constraints reflect reality.

The CPM view uses durations and dependencies only. Resource-constrained scheduling and CPM are returned separately to prevent the dependency-only critical path from being misrepresented as a delivery-risk forecast.

## HTTP boundary

`src/worker.js` provides health and schedule routes, constant-work bearer-token comparison, same-origin enforcement, a 2 MB streamed body limit, security headers, structured validation errors, and static asset delivery. The token is a Cloudflare secret and is never returned.

## Trust model

Inputs are untrusted. IDs, text, arrays, enums, dates, cardinalities, relationships, capacity, and horizon are validated. Output is data rendered with DOM `textContent`; user-controlled HTML is never injected. The engine has no network, storage, or deployment authority.
