# Architecture

`buildDecisionProvenancePacks()` receives product runs, authoritative Projects 18–23 reports, and pack metadata. It selects artifacts only through upstream IDs, creates stable sorted-key JSON records, computes SHA-256 digests with Web Crypto, and links each digest to the previous artifact.

The connected Project 7 route reconstructs all six upstream reports before calling the same engine. The standalone Cloudflare Worker accepts already-built reports for focused use. Neither route persists private keys or presents hashes as signatures.
