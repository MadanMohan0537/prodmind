# Metrics and interpretation

## Product metrics

- Percentage of assessed opportunities with resolved evidence lineage
- Percentage requiring a research review
- Median stale-evidence share
- Median largest-source share
- Percentage with at least two known customer segments
- Time from an integrity finding to refreshed evidence
- Percentage of reviewed findings accepted, dismissed, or resolved by PMs

## Engine measures

- `staleShare`: evidence older than the configured window divided by linked evidence
- `largestSourceShare`: largest channel count divided by linked evidence
- `sourceConcentration`: sum of squared source shares
- `knownSegmentCount`: distinct non-unknown segments
- `unknownSegmentShare`: unknown-segment records divided by linked evidence
- `integrityScore`: 100 minus visible rule penalties, floored at zero

## Interpretation boundary

These are deterministic fitness checks. They do not estimate sampling error, prove representativeness, or establish whether an opportunity should be built. Measure finding usefulness through human review rather than optimizing for fewer warnings.
