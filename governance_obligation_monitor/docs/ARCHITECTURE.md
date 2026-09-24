# Architecture

```text
Project 24 certified governance pack
                  +
 observed digest + dated obligations + named review
                  |
                  v
 deterministic validation and calendar engine
                  |
                  v
 current | blocked_continue | action_required
```

`src/obligations.js` is a pure synchronous engine. It performs no network calls and uses caller-supplied `asOf` timestamps, so the same input produces the same report. `src/worker.js` adds bounded JSON parsing, bearer authentication, same-origin protection, security headers, and static assets. Project 7 reconstructs Projects 18–24 server-side before calling this engine; clients cannot substitute upstream lineage.

The observed digest represents the pack a reviewer actually received. Project 7 compares it with the newly reconstructed, server-owned Project 24 digest. SHA-256 mismatch is an integrity signal, not evidence of malicious behavior or a digital signature.

Limits—50 runs, 50 monitors, 100 obligations per monitor, 2 MB requests—bound Worker work. All final actions remain human decisions.
