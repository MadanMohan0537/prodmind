# Product requirements

## Problem

Project 42 creates a reviewed recovery-action scenario, but approval is not evidence of execution or effectiveness. Product leaders need a bounded closeout record that reconciles every selected action with observed delivery controls before recovery is closed.

## MVP requirements

1. Accept matching Projects 40–42 reports and a later Project 41 report.
2. Require exactly one execution outcome for every selected recovery action.
3. Check completion timing, effort tolerance, execution evidence, and exit evidence.
4. Require prior explicit approval for completed baseline-changing actions.
5. Enforce a declared post-completion observation period.
6. Require the later Project 41 report to reassess every originally failed control.
7. Block closure when any selected action or original control remains unresolved.
8. Preserve schedule, baseline delivery, recovery-plan, follow-up delivery, portfolio-item, and customer-evidence lineage.
9. Keep close, continue monitoring, and escalate as named human decisions.

## Non-goals

- Executing corrective actions or changing their status
- Rebaselining schedules, changing scope or deadlines, or assigning work
- Closing recovery automatically
- Establishing root cause, causality, delivery probability, or EVMS compliance

## Acceptance

- Identical inputs produce identical output.
- A close decision passes only with complete, timely, evidenced execution and restored controls.
- Incomplete observation time, excess effort, missing approvals, late work, and unresolved controls remain visible failures.
