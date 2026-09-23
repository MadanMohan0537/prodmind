# Product requirements

## Problem

ProdMind preserves evidence IDs across the lifecycle, but teams still lack one portable closeout record that proves which authoritative artifacts were reviewed, who approved them, and whether the exported record changed afterward.

## Requirements

- Consume authoritative Project 18–23 reports.
- Reconstruct the artifact chain from server-owned identifiers.
- Canonicalize records deterministically and calculate SHA-256 digests.
- Link artifact digests so ordering and replacement are visible.
- Require product, engineering, and governance approvals.
- Enforce reviewer separation, review freshness, classification, and retention metadata.
- Require a named human certification decision.
- Never claim a checksum is a signature or that a pack proves legal compliance.

## Non-goals

The product is not a document-signing service, records repository, legal opinion, compliance certification, or automatic approval system.
