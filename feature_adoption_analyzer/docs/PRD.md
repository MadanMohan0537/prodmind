# Product requirements

## Problem

ProdMind can discover, prioritize, test, govern, release, and review product work, but it needs a post-release view of whether customers reach value. Raw event counts hide ordering, drop-off, speed, and segment differences.

## User and job

Product managers and product analysts need to inspect a release-linked adoption journey without writing SQL or severing the evidence trail.

## Functional requirements

1. Accept one to twenty journey definitions linked to a Project 19 release.
2. Validate unique event and journey IDs, known stages, ISO timestamps, and bounded payloads.
3. Calculate an ordered funnel from first stage through final value stage.
4. Report step conversion, completion, median time-to-value, invalid users, and privacy-suppressed segment results.
5. Preserve upstream release, opportunity, evidence, decision, and assumption identifiers.
6. Expose a token-protected Worker and system-aware light/dark UI.

## Non-goals

- causal attribution, experimentation, identity resolution, sessionization, warehouse extraction, predictive scoring, or automatic product decisions;
- claiming that missing events prove users did not perform an action;
- displaying rates for cohorts smaller than the declared threshold.

## Acceptance criteria

- deterministic results for the same snapshot;
- malformed or ambiguous inputs fail closed;
- stage order is enforced per user;
- small segment metrics are absent, not merely visually hidden;
- a Project 19 lineage chain is visible in every journey result;
- all tests pass without network calls or paid services.
