# Product requirements

## Problem

Project 52 can verify a bounded recalibration retry, but a successful canary is not enough evidence to make the candidate the durable operating baseline. Teams need a reviewable promotion gate based on sustained observations, healthy controls, current rollback evidence, and independent ownership.

## Users and decision

Product, delivery, operations, and assurance reviewers use this project to decide whether to promote the candidate, extend monitoring, or rollback. The software never performs that decision.

## Requirements

- Preserve exact Project 51 and 52 lineage, version, and scope.
- Require chronological checkpoints across a declared stabilization window.
- Aggregate paired duration and capacity errors by reference class.
- Enforce sample, error, improvement, incident, control, recurrence, and rollback gates.
- Require independent Product, Delivery, Assurance, and final reviewers.
- Return explainable checks for every decision boundary.
- Run on Cloudflare Workers without a paid API or runtime dependency.
