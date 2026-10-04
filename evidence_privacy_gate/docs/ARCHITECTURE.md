# Architecture: Product Evidence Privacy Gate

```
records[] ──► detect(text) ──► findings (type, severity, span, pseudonym)
                   │
                   ├─► redactText ──► redactedText (raw values removed)
                   │
                   └─► policy ──► status per record ──► summary ──► gateStatus
                                                              │
                                                 decideGate(scan, decision, decidedBy, rationale)
                                                              │
                                                       decision record (no side effects)
```

## Components

- `detect`: ordered detector list; earlier detectors win on overlapping spans so a card number is never double-reported as a phone. Context-aware acceptance rules (Luhn, mod-97, SSN issuing rules, digit-run adjacency) keep precision high.
- `pseudonym`: salted FNV-1a 32-bit hash of the normalized value. Deterministic, dependency-free and identical in Node and Workers.
- `scanEvidence`: validates records, applies the policy, produces redacted copies and the gate status. Pure function.
- `decideGate`: validates and records a named human decision. Pure function.

## Connected workflow (Project 7)

1. `POST /api/evidence/privacy-scan` accepts `{ records, policy? }`, returns the scan, and persists `summary`, `gateStatus` and the per-record statuses with the run. Raw records are discarded after the response; only `redactedText` continues into Project 1.
2. `POST /api/evidence/privacy-decision` accepts `{ runId, decision, decidedBy, rationale }`, validates it against the stored scan and persists the decision record.
3. Run creation refuses batches with `gateStatus = decision_required` and no stored decision, following the fail-closed principle.

## D1 migration (connected deployment)

```sql
CREATE TABLE privacy_scans (
  run_id TEXT PRIMARY KEY,
  scanned_at TEXT NOT NULL,
  gate_status TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  policy_json TEXT NOT NULL
);
CREATE TABLE privacy_decisions (
  run_id TEXT PRIMARY KEY REFERENCES privacy_scans(run_id),
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  record_json TEXT NOT NULL
);
```

## Security notes

- The engine never logs raw values.
- The salt is configuration; rotating it breaks pseudonym continuity across runs, which must be a deliberate human choice.
- Same-origin and bearer-token rules of the connected Worker apply unchanged.
