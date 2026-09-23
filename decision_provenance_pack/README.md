# Product Decision Provenance & Governance Pack

Project 24 turns ProdMind’s connected lifecycle into a portable, reviewable governance record. It answers a question the first 23 projects could not answer on their own: **can another reviewer reconstruct the product decision, verify the artifact sequence, and see who accepted responsibility?**

## What it builds

For each Project 23 outcome review, the engine reconstructs seven artifact classes:

1. Customer-evidence and ship-decision lineage.
2. Explicit assumptions.
3. Release-readiness record.
4. Adoption journey.
5. Lifecycle plan.
6. Migration and sunset snapshot.
7. Post-sunset outcome review.

Each canonical record receives a SHA-256 digest and the digests are linked in order. The final pack also checks required approvals, reviewer independence, review timing, classification, and retention policy before recording a human `certify`, `needs_correction`, or `archive` decision.

## Why it belongs in ProdMind

Traceable IDs are valuable while a system is running, but a product organization also needs a durable handoff for governance, audit, incident review, or institutional memory. Project 24 packages the existing evidence without inventing a new score or rewriting upstream decisions.

## Honest security boundary

- Digests detect changed canonical content when recalculated; they are not digital signatures.
- The project has no private-key custody and does not establish signer identity.
- A certified pack is a process-completeness result, not legal or regulatory certification.
- The engine does not alter, approve, release, sunset, restore, or delete a product.

## Run

```bash
cd decision_provenance_pack
npm test
npm run check
npx wrangler dev
```

Set `API_TOKEN` and submit `POST /api/governance-pack` with `runs`, `reports`, and `input.packs`.

## Research basis

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) models provenance through entities, activities, agents, and their relationships.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) explains why deterministic JSON representation matters for repeatable hashing and signing. This implementation uses a documented sorted-key JSON subset and does not claim full JCS conformance.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) emphasizes governed, documented, accountable risk-management processes.
- [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) provides outcome-oriented practices for preserving integrity and provenance in software work.

## Documentation

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

MIT licensed. The connected repository retains its Apache 2.0 license.
