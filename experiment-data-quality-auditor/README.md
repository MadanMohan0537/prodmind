# Experiment Data Quality Auditor

**Can we trust the events before interpreting the experiment?**

An event-level quality gate for product teams. It checks exposure and conversion logs before producing binary-outcome aggregates for downstream experimentation analysis.

This is the replacement for portfolio idea 7. It complements the AI Experimentation Copilot: the Copilot analyzes aggregate outcomes; this project checks the raw records used to create those aggregates. It is a deterministic engineering component, not an LLM product disguised as a validator.

## What works today

- Strict event identifiers, variant/type enums, experiment ownership, and UTC timestamps
- Duplicate event-ID detection, including identical replays
- Detection of users exposed to both variants
- Conversion-to-exposure relationship and temporal-order checks
- Unique-user aggregation: repeated exposure or conversion events do not inflate denominators or binary outcomes
- Fail-closed export: any detected defect blocks the entire aggregate
- Row-level findings without raw user identifiers in the report
- Dependency-free Node CLI and an authenticated, stateless Cloudflare Worker endpoint
- Streamed API body limit, no-store responses, and automated core/HTTP/CLI tests

No runtime package installation, model key, database, or paid service is required for local execution.

## Quick start

Use Node.js 22 or later:

```bash
git clone https://github.com/MadanMohan0537/prodmind.git
cd prodmind/experiment-data-quality-auditor
npm test
npm run demo
node src/cli.js examples/clean.json
```

CLI exit codes: `0` checks passed; `2` quality defects detected; `1` invalid input envelope or file error. This makes it usable as a pipeline gate. JSON is written to stdout; input errors go to stderr.

## Input contract

```json
{
  "experiment_id": "pricing-v1",
  "events": [
    {
      "event_id": "unique-event-id",
      "experiment_id": "pricing-v1",
      "user_id": "pseudonymous-user-id",
      "variant": "control",
      "type": "exposure",
      "timestamp": "2026-09-01T00:00:00.000Z"
    }
  ]
}
```

Both `control` and `treatment` need exposed users to pass. Supported types are `exposure` and `conversion`. Timestamps must use the exact UTC millisecond format shown above and represent real calendar dates. The CLI and API enforce 2 MB; the core accepts at most 10,000 events. Unknown extra fields are ignored, not retained in reports. Identifiers are case-sensitive.

Use the same reporting interval and one predeclared conversion definition for every event. Extract complete exposure history for included users; arbitrary truncated windows can create false orphan findings.

## Output and policy

The included clean fixture returns:

```json
{
  "status": "pass",
  "aggregate": {
    "control": {"visitors": 1, "conversions": 0},
    "treatment": {"visitors": 1, "conversions": 1}
  }
}
```

The actual response also contains the experiment ID, schema version, row counts, findings and explanation. This tiny fixture tests plumbing; it is not evidence of a treatment effect.

If any check fails, `status` becomes `blocked` and `aggregate` is `null`. We do not silently deduplicate defective event IDs or drop contaminated users and release a seemingly clean result. Correct upstream logging or explicitly prepare a corrected source file, then rerun.

## Relationship to the Experimentation Copilot

1. Export pseudonymous raw events from your analytics system.
2. Run this auditor.
3. If blocked, investigate the reported checks.
4. If passed, map `aggregate.control` and `aggregate.treatment` to the Copilot's primary metric arms.
5. Supply the real predeclared design, duration, guardrails and decision-look information separately.

This handoff is manual; there is no live connector to another repository. Sample-ratio mismatch and statistical inference belong downstream and are not duplicated here. A passed audit never authorizes shipping.

## Optional Cloudflare deployment

The Worker source and `wrangler.jsonc` are included. With a configured Cloudflare account and Wrangler CLI:

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

Send JSON to `POST /api/audit` using `Authorization: Bearer <your-token>`. `GET /health` is public. The audit endpoint returns HTTP 200 for a completed audit even when the report is `blocked`; clients must inspect `status`. Transport errors use 4xx; a missing server token returns 503.

There is no permissive CORS policy, persistence, telemetry logging, or public export endpoint. Keep tokens out of repositories and browser applications. Shared-token authorization is not tenant isolation. Configure abuse protection before exposing to untrusted clients. Hosting is optional, not deployed as part of this package; provider usage limits still apply. Cloudflare execution has not been remotely verified.

## Research behind the choice

Microsoft Research describes data loss, telemetry inconsistencies and assignment imbalance as threats to trustworthy experimentation. Its SRM research emphasizes that detecting an anomaly does not establish its root cause. This project applies that distinction: findings report observed defects, not invented causal explanations.

- [Data quality foundations for trustworthy A/B analysis](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/data-quality-fundamental-building-blocks-for-trustworthy-a-b-testing-analysis)
- [Diagnosing sample-ratio mismatch: research paper](https://www.microsoft.com/en-us/research/publication/diagnosing-sample-ratio-mismatch-in-online-controlled-experiments-a-taxonomy-and-rules-of-thumb-for-practitioners/)
- [During-experiment quality metrics](https://www.microsoft.com/en-us/research/?p=720145)

## Limits and next steps

The auditor cannot detect events that never arrived without a separate source of truth. It does not validate randomization, consent, bot filtering, cross-device identity, observation-window maturity, attribution windows, SRM, or causality. It supports only user-level, two-variant, binary-conversion experiments. Equal-time exposure and conversion events are allowed.

Next increments: source-count reconciliation, configurable attribution windows, an immutable audit registry, and explicit adapters for analytics exports. A local model may later explain findings, but will not decide whether records pass. No live vendor integration, trained model, dashboard or automatic repair is claimed.

## Files

- `src/audit.js`: pure validation and aggregation engine
- `src/cli.js`: local command-line entry point
- `src/worker.js`: optional HTTP boundary
- `tests/audit.test.js`: core, API, and CLI tests
- `examples/clean.json`: synthetic runnable fixture
- `docs/PRD.md`: scope and acceptance criteria
- `../.github/workflows/experiment-data-quality-auditor.yml`: active monorepo CI (26 tests and the demo)
- `.github/workflows/ci.yml`: standalone workflow template, inactive while nested inside ProdMind

## License

MIT. See LICENSE.
