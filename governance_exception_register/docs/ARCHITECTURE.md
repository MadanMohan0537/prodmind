# Architecture

```text
Project 25 failed check or obligation
        + scoped request + expiry + controls + remediation + approvals
                              |
                              v
              deterministic exception engine
                              |
                              v
 active_exception | blocked_approval | rejected | closed
```

`src/exceptions.js` is deterministic and stateless. The caller supplies `asOf`; no ambient clock or external service changes the answer. Project 7 reconstructs Projects 18–25 before invoking it, so clients cannot replace authoritative lineage or silently make a failed monitor current.

The Cloudflare Worker bounds requests to 2 MB, 50 runs, 50 registers, and 100 exceptions per register. It requires a bearer token and same-origin API requests. A shared token is appropriate only for one trusted team, not tenant isolation.
