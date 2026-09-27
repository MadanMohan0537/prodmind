# Architecture

```text
Project 27 verified exit + later Project 25 snapshots
                         |
                         v
 lineage + target + remediation + coverage + cadence
                         |
                         v
 stable | blocked_keep_closed | action_required
```

The pure engine uses explicit timestamps and no network calls. The Worker provides bearer authentication, same-origin enforcement, bounded JSON parsing, security headers, and static assets.
