<div align="center">

# Product Governance Exception & Waiver Register

**Project 26 of ProdMind — govern temporary risk acceptance without turning a failed control green.**

[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020)](https://developers.cloudflare.com/workers/) [![License](https://img.shields.io/badge/license-Apache--2.0-2563EB)](LICENSE)

</div>

Product governance needs a controlled path for the rare case where work must continue while a failed control is being remediated. Informal waivers are dangerous: they lose scope, ownership, evidence, expiry, and accountability. This project consumes Project 25 findings and records a narrow, time-bounded exception with compensating controls, an open remediation obligation, independent approvals, and a named decision.

An active exception never changes Project 25's `blocked_continue` or other upstream status. It documents temporary human risk acceptance; it is not compliance, legal authority, or a permanent bypass.

## Controls

- Target must be a real failed check or problematic obligation.
- Maximum duration is 180 days for low, 90 for medium, 30 for high, and 7 for critical risk.
- Approval requires evidenced compensating controls.
- Remediation must link to an open Project 25 obligation.
- Product and Governance approve every exception; high and critical exceptions also require Risk approval.
- Requester cannot approve their own request.
- An exception cannot be closed while its target still fails.
- Multiple active exceptions cannot overlap on one target in a register.

## Connected architecture

```text
Projects 18–24 authoritative governance record
                    ↓
Project 25 failed check or obligation
                    ↓
scope + risk + expiry + controls + remediation + approvals
                    ↓
Project 26 deterministic exception register
                    ↓
active_exception | blocked_approval | rejected | closed
```

The implementation is plain JavaScript for Cloudflare Workers and uses no paid API, model, database, or software dependency. The standalone frontend follows the browser's light/dark preference. Project 7 rebuilds every upstream report server-side before calling the engine.

## Run

```bash
npm test
npm run check
npx wrangler secret put API_TOKEN
npx wrangler dev
```

Use `POST /api/governance-exceptions` with a Project 25 report and `input.registers`. Requests require `Authorization: Bearer <API_TOKEN>`. See the preloaded browser example for the complete schema.

## Research basis

- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) includes risk-response and plan-of-action controls that informed explicit acceptance and remediation linkage.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) makes governance and risk-management responsibilities explicit.
- [NIST SP 800-39](https://csrc.nist.gov/pubs/sp/800/39/final) treats risk response as an accountable organizational process rather than an implicit technical bypass.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) supports governed, measured, and managed risk across the lifecycle.

These sources inform the workflow only. Organization policy, counsel, and accountable leaders determine whether an exception is permissible.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Metrics](docs/METRICS.md)

Apache-2.0 licensed. See [LICENSE](LICENSE).
