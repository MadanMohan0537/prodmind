# Architecture

The pure `src/learning.js` engine consumes the Project 37 report plus human-authored learning reviews. It validates lineage and evaluates explicit controls without network calls. `src/worker.js` provides a bounded authenticated Cloudflare interface. Project 7 reconstructs Projects 18–37 before invoking the same engine.

Trust boundaries: all evidence is untrusted input; decisions remain named human choices; the output is readiness evidence rather than execution authority.
