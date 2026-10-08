# Product requirements

## Problem

Project 38 can approve a safe re-entry proposal after an incident, but approval alone does not show that actual exposure followed the proposal or that corrective controls remained effective. Teams need a bounded assurance record before continuing.

## Users

- Product and planning-operations leaders
- Reliability and analytics owners
- Governance and risk reviewers
- Engineering owners of preventive and detective controls

## Functional requirements

- Accept only a versioned Project 38 report.
- Preserve Projects 32–38 lineage.
- Require a pre-exposure declaration.
- Constrain owner, baseline, scope, stages, dwell, gaps, and exposure.
- Require observation evidence, minimum samples, incident-condition monitors, guardrails, and critical-action checks.
- Return deterministic checks and a named human decision.
- Bound all collections, text, timestamps, and request size.

## Non-goals

- Starting, pausing, expanding, or refreezing trials
- Changing policy or routing
- Proving causal impact or regulatory compliance
- Ranking individuals or assigning blame
- Replacing incident command, deployment, monitoring, or experimentation systems

## Acceptance criteria

- Valid bounded fixture returns `verified_reentry`.
- Any failed check blocks a `continue` decision.
- `pause` and `refreeze` always return `action_required`.
- Invalid lineage, incomplete monitoring, or malformed evidence fails closed.
- Worker authentication, same-origin enforcement, size bounds, light/dark UI, documentation, and tests are present.

