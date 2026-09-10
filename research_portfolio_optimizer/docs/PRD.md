# Product requirements

## Problem

Evidence-integrity findings create more potential research work than a team can execute. Choosing only the easiest study can leave high-severity gaps untouched, while choosing only the most severe can consume all capacity inefficiently.

## User

Product managers, research leads, and founders planning a research cycle.

## Jobs

1. Convert evidence findings into concrete research actions.
2. Enter a consistent capacity budget.
3. Select the highest-priority feasible portfolio.
4. See which gaps remain uncovered and why.
5. Trace every selected action to the original opportunity and integrity finding.

## Acceptance criteria

- Accept a valid Project 11 integrity report.
- Derive actions for every supported finding code.
- Accept at most 16 reviewed actions.
- Enforce capacity and dependencies.
- Count each covered finding once.
- Return an exact bounded optimum with deterministic tie-breaking.
- Expose selected and uncovered targets.
- Fail closed without API authentication.

## Non-goals

- Automatic researcher assignment
- Calendar scheduling
- Recruitment management
- Statistical power calculation
- Automatic reprioritization
- LLM-generated research conclusions
