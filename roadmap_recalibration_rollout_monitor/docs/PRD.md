# Product requirements

## Problem

Project 48 can approve a bounded, holdout-tested estimate recalibration. Approval alone does not prove that the exact version and factors were safely introduced to real planning work. A direct activation would erase the concurrent baseline and expand the impact of a defective change.

## User and job

Product operations, engineering operations, portfolio leaders, and independent assurance reviewers need a reviewable way to decide whether to promote, pause, or roll back a recalibration after shadow and staged use.

## Requirements

- Accept only an approved Project 48 report.
- Pin the baseline version, candidate version, and exact approved factors.
- Require a zero-exposure shadow stage before active stages.
- Require strictly increasing active exposure through a declared ceiling.
- Compare active and candidate errors on paired, concurrent cohorts.
- Enforce minimum dwell, sample size, accuracy, improvement, incident, evidence, and rollback gates.
- Require a named human decision.
- Never change exposure, activate factors, edit estimates, or execute rollback.

## Non-goals

- Statistical-significance claims
- Automatic traffic or policy changes
- Replacing change-management or production observability systems
- Guaranteeing future estimate accuracy

## Acceptance

A promotion can be marked `verified_rollout` only when every deterministic gate passes and a named reviewer selects `promote`. `pause` and `rollback` always remain `action_required`.

