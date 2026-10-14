# Product requirements

## Problem

Project 44 can derive transparent reference-class factors from completed roadmap work. ProdMind cannot yet prove that a newly approved Project 40 estimate used those factors. A team can consult the calibration, enter different values, and leave no governed explanation.

## Outcome

Produce a reviewable control record showing that every scheduled estimate reconciles to a prior adopted calibration or a prior, independently approved exception.

## Users

Product leaders, delivery leads, engineering managers, portfolio analysts, investment committees, and assurance reviewers.

## Functional requirements

- Accept only an approved Project 40 schedule and a prior adopted Project 44 calibration.
- Require exactly one application record per scheduled item.
- Require a sufficiently sampled reference class and preserve its sample size.
- Reconcile base values, applied factors, and approved duration and capacity.
- Enforce declared rounding tolerances and calibration freshness.
- Require a prior independent exception when a recommendation is not applied.
- Preserve customer evidence and both estimate-basis narratives.
- Require a named approve, revise, or defer review.
- Run on Cloudflare Workers without paid services.

## Non-goals

Generating estimates, applying factors automatically, changing schedules, certifying statistical confidence, predicting delivery, evaluating individuals, or replacing an accountable human approval.
