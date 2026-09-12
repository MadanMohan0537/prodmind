# Product requirements

## Problem

ProdMind preserves customer evidence, but preservation alone does not tell a PM whether the evidence supporting an opportunity is still fit for reuse. Age, channel concentration, unknown segments, small samples, and broken identifiers can make a confident-looking opportunity weak.

## User

Product managers and researchers reviewing an opportunity before prioritization, experiment planning, or roadmap reuse.

## Jobs

1. Identify opportunities whose evidence needs review.
2. Understand the exact reason and policy threshold.
3. Follow every finding back to the original evidence IDs.
4. Reassess evidence over time without mutating historical decisions.

## MVP acceptance criteria

- Assess up to 50 ProdMind runs.
- Resolve every opportunity evidence ID against its run.
- Report freshness, source, segment, sample-size, and polarized-signal findings.
- Return deterministic scores for the same input, policy, and `asOf` timestamp.
- Never fabricate missing segments or sources.
- Preserve run, opportunity, and evidence identity.
- Emit `portfolioItemId` as `runId:opportunityId` for every cross-run assessment.
- Fail closed without API authentication.

## Non-goals

- Statistical representativeness certification
- Causal inference
- Automatic deletion of old evidence
- Automatic reprioritization
- Employee or researcher performance scoring
- Semantic contradiction detection
