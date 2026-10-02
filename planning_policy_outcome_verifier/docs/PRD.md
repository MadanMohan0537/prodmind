# Product requirements

## Problem

Project 32 can approve a reversible planning-policy experiment, but approval is not proof that the completed experiment worked. ProdMind needs an auditable gate between an observed trial and permanent policy adoption.

## Users and job

Product operations leaders and planning councils need to verify a completed trial against its predeclared target, guardrail, sample size, observation window, and evidence without allowing an AI system to change policy.

## Requirements

- Accept only an approved Project 32 plan.
- Preserve Project 31 outcome-review lineage and Project 32 experiment identity.
- Evaluate numeric primary and guardrail measures deterministically.
- Block adoption when any prerequisite fails.
- Require a named human decision and rationale.
- Never infer causality, rank people, edit estimates, or change policy automatically.

## Non-goals

This release is not a statistical causal-inference engine, performance-management system, or automated rollout controller.

