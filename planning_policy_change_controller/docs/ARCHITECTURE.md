# Architecture

The pure controller joins each proposed change to a Project 33 verified outcome and an active policy baseline. Seven transparent checks determine whether the proposal is ready for a human-controlled activation workflow. The Worker supplies authentication and bounded transport; it does not execute changes.

```text
Project 33 verified adopt outcome + active policy baseline
                         |
                         v
version + scope + rollout + monitors + rollback + evidence + approvals
                         |
                         v
ready_to_activate | blocked_activation | action_required
```

The implementation uses only JavaScript platform APIs and is compatible with Cloudflare Workers.

