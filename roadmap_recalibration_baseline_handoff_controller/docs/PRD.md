# Product requirements

## Problem

Project 54 verifies a promoted calibration outcome, but downstream consumers can still reference inconsistent versions. A split baseline can silently invalidate schedules, estimate adoption, effectiveness comparisons, drift windows, and the next recalibration.

## Decision

Product, delivery, estimation-platform, and assurance owners decide whether the baseline handoff is complete, should continue, or should roll back. This controller never changes consumer configuration.

## Requirements

- Preserve exact Project 54 lineage, versions, scope, and timing.
- Register every reference class against one factor manifest.
- Require acknowledgments from five governed estimation consumers.
- Archive the superseded baseline immutably for a minimum period.
- Preserve an exact, current, owned rollback path.
- Assign distinct effectiveness and drift follow-up owners.
- Require independent approvals and final review.
- Run on Cloudflare Workers without paid services.
