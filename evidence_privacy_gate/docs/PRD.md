# PRD: Product Evidence Privacy Gate (Project 36)

## Problem

ProdMind ingests customer feedback that may contain email addresses, phone
numbers, card numbers, government identifiers and pasted credentials. Today the
only safeguard is a README instruction to use pseudonymous data. A single
unredacted batch would put raw personal data into D1, the learning memory and
every downstream artifact digest.

## Goals

1. No raw personal or secret value from a scanned batch is ever returned by the engine or stored by the connected workflow.
2. Redaction preserves analytic value: the same email always becomes the same pseudonym within a deployment.
3. Consequence-sensitive findings (card numbers, SSNs, credentials) stop the batch until a named person decides.
4. Every batch leaves an auditable scan summary and decision record linked to the evidence identities.

## Non-goals

- Detecting names, postal addresses or free-text identifiers.
- Encrypting or signing evidence.
- Deleting data from sources.

## Users

- Product manager uploading feedback: wants fast admission of clean batches and clear reasons when a batch is held.
- Governance reviewer: wants to see what was found, by type and severity, and who decided what.
- Engineer: wants a pure function with no network or model dependency.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| R1 | Scan returns per-record status in {clean, redacted, blocked, malformed} | Tests cover each status |
| R2 | Card numbers are reported only when the Luhn checksum passes | Invalid checksum is not a finding |
| R3 | SSN detection follows area/group/serial rules | 000-, 666-, 9xx- areas are not findings |
| R4 | Phone detection never fires inside a longer digit sequence | Card and IBAN digits are not phones |
| R5 | Redacted text replaces each finding with `[TYPE#pseudonym]` | Raw value absent from output |
| R6 | Pseudonyms are stable within a salt and differ across salts | Tested |
| R7 | Policy must classify every finding type exactly once | Engine throws otherwise |
| R8 | Gate status is `decision_required` when any record is blocked | Tested |
| R9 | A decision requires a named decider and a rationale, and must be valid for the gate status | Tested |
| R10 | The engine performs no storage, deletion or network call | Code review |

## Open questions for human review

- Should `email` be blocking rather than redactable for deployments in regulated markets? The policy supports both; the default redacts.
- Which salt rotation cadence is acceptable, given that rotation breaks pseudonym continuity across runs?
