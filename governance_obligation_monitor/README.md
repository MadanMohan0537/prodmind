<div align="center">

# Product Governance Obligation & Review Monitor

**Project 25 of ProdMind — keep certified product decisions reviewable after the certification date.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/) [![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](LICENSE)

</div>

A decision record does not stay trustworthy merely because it was once certified. Evidence can change, obligations become overdue, reviews and approvals age, and retention periods eventually require an explicit disposition decision. This project turns those time-dependent controls into a deterministic, evidence-linked review.

It consumes Project 24's server-built governance pack and preserves its `portfolioItemId` and `evidenceIds`. It compares the digest actually observed by the reviewer with the current authoritative digest, evaluates dated obligations, and records a named human decision. It never deletes a record, recertifies a decision, or changes a product.

## What it checks

- Project 24 pack was certified.
- Observed SHA-256 digest still matches the authoritative pack.
- Open evidence refreshes, approval renewals, control tests, corrective actions, and disposition tasks are not overdue.
- Completed and waived obligations include evidence.
- The next review and certification dates have not expired.
- Disposal is neither premature nor omitted after retention expires.
- Continue, remediate, recertify, and dispose remain attributable human choices.

## Architecture

```text
Projects 18–23 lifecycle evidence
              ↓
Project 24 canonical governance pack + digest chain
              ↓
Observed digest + obligations + review policy + as-of date
              ↓
Project 25 deterministic control and calendar engine
              ↓
current | blocked_continue | action_required
```

The zero-paid-service implementation is plain JavaScript for Cloudflare Workers. It needs no LLM or external API. The standalone interface supports system-aware light and dark themes; Project 7 provides the connected route.

## API

`POST /api/governance-obligations` requires `Authorization: Bearer <API_TOKEN>` and JSON:

```json
{
  "runs": [],
  "report": {"schemaVersion":"1.0.0","packs":[]},
  "input": {
    "monitors": [{
      "id":"monitor-1",
      "governancePackId":"pack-1",
      "asOf":"2027-03-10T00:00:00Z",
      "observedPackDigest":"<64 lowercase hex characters>",
      "reviewIntervalDays":30,
      "certificationValidDays":365,
      "obligations":[{"id":"control-1","type":"control_test","owner":"Governance lead","dueAt":"2027-03-20T00:00:00Z","status":"open"}],
      "review":{"reviewer":"Product governance","decision":"continue","rationale":"Controls remain current.","reviewedAt":"2027-03-10T00:00:00Z"}
    }]
  }
}
```

## Run and test

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

Deploy with `npx wrangler deploy`. Cloudflare account quotas still apply.

## Research basis

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) makes governance and continuous risk-management outcomes explicit.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) emphasizes governed, measured, and managed risk over time.
- [NARA records scheduling guidance](https://www.archives.gov/records-mgmt/scheduling) distinguishes approved retention and disposition from arbitrary deletion.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) provides the provenance model underlying traceable entities, activities, and agents.

These references inform the controls; this software does not claim certification or legal compliance.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Metrics and guardrails](docs/METRICS.md)

Apache-2.0 licensed. See [LICENSE](LICENSE).
