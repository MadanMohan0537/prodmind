# PRD — Product Release Readiness & Rollback Controller

## Problem

Product approval and production safety are different decisions. Teams need an auditable gate that links the product rationale to staged exposure, observable thresholds, named responders, and a reversible path.

## MVP

1. Review 1–50 releases across at most 50 ProdMind runs.
2. Require a human `ship` decision for the selected opportunity.
3. Consume Project 18 assumptions and block unresolved high-exposure items.
4. Validate progressive rollout, monitoring and rollback declarations.
5. Preserve upstream evidence and decision identities.
6. Return transparent failed checks without taking deployment action.

## Non-goals

CI/CD execution, traffic control, automatic rollback, live telemetry ingestion, SLO inference, compatibility testing, or incident response.
