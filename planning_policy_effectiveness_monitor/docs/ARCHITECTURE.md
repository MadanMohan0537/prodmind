# Architecture

```text
Project 32 predeclared measures + Project 33 verified adoption
                              + Project 35 verified rollout
                                             ↓
                     Longitudinal effectiveness observations
                                             ↓
       Lineage → window → cadence → version → sample → outcome → evidence
                                             ↓
             sustained_effectiveness | blocked_retain | action_required
                                             ↓
                            Named human decision
```

`src/effectiveness.js` is dependency-free and deterministic. The Worker accepts bounded authenticated JSON, rejects cross-origin API requests, and serves static assets. Project 7 reconstructs Projects 18–35 server-side before invoking the same engine.

The engine compares observations with the experiment's predeclared measures. It does not fabricate a target, perform policy actions, or interpret association as causation.
