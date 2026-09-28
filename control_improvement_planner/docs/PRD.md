# PRD — Product Control Improvement Portfolio Planner

## Problem

Projects 25–28 identify control failures, govern exceptions, verify remediation, and detect recurrence. They do not convert recurrence evidence into a bounded improvement portfolio. Teams can therefore acknowledge the same systemic weakness repeatedly without a transparent capacity decision.

## User and job

Product governance leads, control owners, engineering leaders, and product councils need to decide which evidence-backed improvements to fund now, what remains uncovered, and who will verify success.

## MVP requirements

1. Consume an authentic Project 28 report without replacing upstream identities.
2. Derive targets only from failed checks or observed recurrence.
3. Validate owner, effort, response, due date, success metric, verification window, and dependencies.
4. Select the maximum unique recurrence-risk coverage within capacity using deterministic code.
5. Block an approval that misses the reviewer's minimum coverage threshold.
6. Preserve a named approve, revise, or defer decision.
7. Expose an authenticated Worker endpoint and responsive light/dark interface.

## Non-goals

- Executing control changes or creating external tickets
- Assigning work or changing upstream records
- Estimating financial loss or probability
- Claiming compliance or control effectiveness
- Using an LLM to perform optimization

## Acceptance criteria

- Identical ordered inputs produce identical output.
- Capacity and dependencies are never violated.
- One finding covered by multiple actions is counted once.
- Missing recurrence evidence cannot be converted into a target.
- The connected Project 7 path preserves the original evidence IDs.

