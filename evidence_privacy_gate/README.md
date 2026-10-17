# Project 36: Product Evidence Privacy Gate

Deterministic detection and pseudonymization of personal and secret data in
customer evidence before it enters the ProdMind workflow.

ProdMind's root README warns that "feedback content and customer identifiers
may be sensitive; use pseudonymous data." Until now that was advice. Project 36
makes it a gate: every batch is scanned, redactable findings are replaced with
stable pseudonyms, blocking findings stop the batch, and a named human records
what happens next. The engine never stores, deletes or forwards a record.

## What it contributes

| Capability | Behavior |
| --- | --- |
| Detection | Emails, phone numbers, IPv4 addresses, IBANs (mod-97 check), card numbers (Luhn check), US SSNs (issuing rules), API tokens and credentials |
| Pseudonymization | `[EMAIL#3f9a1c2d]` style tokens from a salted FNV-1a hash, so the same email maps to the same token within a deployment and never across deployments |
| Policy | Every finding type is classified as redactable or blocking; the engine refuses an incomplete or contradictory policy |
| Gate | `admit` (nothing blocked), `decision_required` (blocked findings), `reject` (empty or entirely malformed batch) |
| Human decision | `admit_redacted`, `quarantine`, or `reject_batch` with a named decider and a rationale; validated against the scan and recorded, never executed |
| Lineage | `feedbackId` is preserved on every record; duplicates and malformed records are reported, not dropped silently |

## Run

```bash
cd evidence_privacy_gate
npm run check
```

No dependencies. Node.js 22 or later.

## API

```js
import { scanEvidence, decideGate } from "./src/privacyGate.js";

const scan = scanEvidence(
  [{ feedbackId: "f-1", text: "Email me at jane@example.com about the export bug" }],
  { blocking: ["card_number", "ssn", "secret"], redactable: ["email", "phone", "ipv4", "iban"] },
);
// scan.records[0].status === "redacted"
// scan.records[0].redactedText === "Email me at [EMAIL#...] about the export bug"
// scan.gateStatus === "admit"

const decision = decideGate({
  scan,
  decision: "admit_redacted",
  decidedBy: "Priya N.",
  rationale: "Only an email address, redacted before storage.",
});
```

Raw values never appear in the scan output. Blocked records still get a
redacted copy so a reviewer can read them without seeing the raw value.

## Position in the lifecycle

```
Customer feedback
      ↓
36. Privacy gate: scan, pseudonymize, block, record a named decision
      ↓
1. Normalize and validate (Project 1 receives only admitted records)
```

Connected integration (commit 3 in the usual structure): Project 7 calls
`scanEvidence` before Project 1 ingestion at `POST /api/evidence/privacy-scan`,
persists the scan summary and the decision record with the run, and refuses to
create a run from a batch whose gate status is `decision_required` without a
recorded decision.

## Decision boundary

- Detection is pattern-based and deterministic; it is not a guarantee that no personal data remains. Names, addresses and free-text identifiers are out of scope and should be handled by source-side pseudonymization.
- Pseudonyms are for linking, not security. Treat the salt as configuration, not as a secret key.
- The gate records a human decision; it never admits, deletes or forwards evidence itself.
- One deployment is one trusted team; the policy is deployment-wide.

## Verification

- `node --test "test/**/*.test.mjs"`: 8 focused tests covering detector precision (Luhn, SSN issuing rules, IBAN mod-97, no detector overlap, long digit runs are not phones), pseudonym stability, statuses, summary counts, gate status, policy validation and decision validation.
- No paid APIs or dependencies.

## Documentation

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)
