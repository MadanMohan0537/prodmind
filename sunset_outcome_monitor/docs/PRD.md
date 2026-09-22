# Product requirements

## Problem

Project 22 proves that a migration is ready for a human sunset decision. It does not prove that the completed sunset avoided customer harm, removed traffic, delivered expected savings, or remains recoverable.

## User and job

Product, Engineering, Support, FinOps, and Reliability reviewers need one evidence-linked closeout record before declaring a retirement complete.

## Requirements

- Consume only a valid Project 22 report and preserve its lineage.
- Enforce an explicit observation window.
- Compare support contacts and incidents with declared thresholds.
- Require zero residual traffic.
- Compare observed with expected savings without claiming causality.
- Validate a named, tested rollback owner and recovery target.
- Track owned corrective actions and overdue work.
- Record a named human `close`, `extend_monitoring`, or `restore_service` decision.
- Never close, deploy, restore, route traffic, or delete data.

## Non-goals

The project is not an incident manager, causal inference engine, billing connector, deployment controller, or automatic decision maker.
