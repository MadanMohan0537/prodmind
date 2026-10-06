# Product requirements

## Problem

Project 36 records whether an adopted planning policy should be retained, adjusted, or reverted. A revert decision alone does not demonstrate that the prior version was restored or that the system recovered. Closing without this evidence leaves an assurance gap.

## Users and job

Product operations, engineering, governance, and planning councils need to verify a completed policy reversion before closing it, without granting software authority to execute or approve the change.

## Inputs

- Project 36 effectiveness report with a named `revert` decision.
- Project 35 rollout report retaining Project 34 rollback and monitor controls.
- Reversion initiation time and ordered execution snapshots.
- At least two ordered recovery snapshots with all declared monitor values.
- Recovery-window and cadence limits.
- Named `close_reversion`, `continue_monitoring`, or `escalate` review.

## Outputs

- `verified_recovery`, `blocked_close`, or `action_required`.
- Individual control results, monitor checks, execution/recovery evidence, and Projects 32–36 lineage.

## Non-goals

The product does not execute reversion, alter configuration, declare causality, waive controls, or replace incident/change management.

## Acceptance criteria

1. Close is verified only when every deterministic control passes.
2. A premature close is blocked with specific failed checks.
3. Continue and escalate remain human actions regardless of checks.
4. Malformed or disconnected evidence is rejected.
5. Standalone and connected APIs run on Cloudflare Workers without paid dependencies.
