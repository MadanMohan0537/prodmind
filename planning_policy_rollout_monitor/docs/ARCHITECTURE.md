# Architecture

The pure monitor joins each observed rollout to a Project 34 approved proposal. It reconciles stage sequence and dwell, verifies version identity, evaluates monitor values, and emits a lineage-preserving assurance report. The Worker provides bounded authenticated transport only.

```text
Project 34 ready change + observed rollout snapshots
                         |
                         v
timing + stages + dwell + version + thresholds + evidence
                         |
                         v
verified_rollout | blocked_continue | action_required
```

All computation uses JavaScript platform APIs and runs on Cloudflare Workers without paid services.

