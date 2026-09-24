# Product requirements

## Problem

A governance pack can be valid when certified and silently become stale later. Digests drift, recurring control tests and corrective actions pass their deadlines, review windows lapse, certifications expire, and retention periods end. Project 25 turns those time-dependent commitments into an explicit review queue.

## Users and job

Product operations, governance, engineering leaders, records owners, and internal reviewers need to know which certified decisions remain current and which need human action—without granting an automated system authority to dispose of records or change products.

## MVP

- Accept a Project 24 report and 1–50 monitor records.
- Compare an observed digest with the authoritative pack digest.
- Validate owned, dated obligations and supporting evidence.
- Calculate review, certification, and retention deadlines deterministically.
- Require an attributable continue, remediate, recertify, or dispose decision.
- Preserve portfolio and customer-evidence lineage.
- Expose authenticated standalone and connected Worker routes.

## Non-goals

The system does not prove signer identity or legal compliance, predict risk, delete records, change product state, or replace counsel and records-management policy.
