# Product Requirements

## Problem

Project 31 exposes whether improvement planning is calibrated, but a failed calibration check is not itself a safe policy change. Teams need a governed way to test a small number of planning adjustments without turning one portfolio snapshot into permanent process policy.

## User and job

Product operations, engineering operations, and governance leaders need to convert explicit calibration gaps into reversible, owned policy experiments that fit limited change capacity and have measurable success and rollback criteria.

## Requirements

- Accept a versioned Project 31 calibration report and derive targets only from failed checks.
- Require each candidate to declare scope, owner, effort, policy area, hypothesis, change, success metric, guardrail, rollback plan, observation window, and dependencies.
- Reject non-reversible candidates and candidates that cover passing or unknown checks.
- Select the highest unique weighted gap coverage within declared capacity using exact bounded optimization.
- Prefer lower effort, fewer experiments, and stable input order when coverage is tied.
- Block approval below the human-declared minimum coverage rate.
- Require a named approve, revise, or defer decision with rationale and timestamp.
- Authenticate API requests, enforce same-origin access, cap JSON bodies at 2 MB, and support light and dark system themes.

## Non-goals

- Automatically changing estimation rules, delivery policy, team process, or staffing.
- Claiming an experiment will work or that a calibration gap has one cause.
- Ranking teams or individuals.
- Statistical significance testing or causal attribution.
- Replacing change-management, labor, legal, or governance review.

## Acceptance

The same valid input always produces the same optimal subset. An approval cannot pass if weighted coverage is below its declared threshold. Every selected experiment remains a reversible proposal requiring execution and later outcome review outside this project.
