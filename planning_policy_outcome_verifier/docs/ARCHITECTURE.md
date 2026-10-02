# Architecture

The pure `verifyPolicyExperimentOutcomes` engine receives an approved Project 32 plan and observed reviews. It validates boundaries, joins reviews to selected experiments, applies six deterministic checks, and emits lineage-preserving decisions. The Worker is a thin authenticated adapter; static assets provide a same-origin interface.

```text
Project 32 approved experiment plan
               +
observations, evidence, human decision
               |
               v
deterministic prerequisite checks
               |
               v
verified_adopt | blocked_adopt | action_required
```

All computation uses the JavaScript standard library and runs on Cloudflare Workers without paid APIs or hosted models.

