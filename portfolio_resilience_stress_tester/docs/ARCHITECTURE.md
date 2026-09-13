# Architecture

```text
Project 6 selected portfolio
        +
Project 13 reviewed mappings and ranges
        +
Declared capacity, dependency and effort scenarios
        ↓
Deterministic stress engine
        ↓
Scenario exposure, weakest case and at-risk evidence
```

`portfolioItemId` (`runId:opportunityId`) is the cross-run key. Dependencies are canonicalized within their source run. The engine is stateless and does not modify D1.

Each scenario is evaluated independently. The score is a transparent bounded penalty over capacity overrun, unavailable commitments, dependency failures, and objective-range violation. It is a review index, not a probability.
