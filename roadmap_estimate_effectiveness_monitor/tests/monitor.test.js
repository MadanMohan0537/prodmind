import test from "node:test";
import assert from "node:assert/strict";
import { monitorRoadmapEstimateEffectiveness } from "../src/monitor.js";

const schedule = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "schedule-1",
  asOf: "2027-02-01T00:00:00Z",
  status: "approved_schedule",
  schedule: [{
    portfolioItemId: "run:item",
    title: "Improve onboarding",
    durationDays: 12,
    capacity: 2,
    evidenceIds: ["feedback-1"],
  }],
  ...overrides,
});

const delivery = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "delivery-1",
  asOf: "2027-02-28T00:00:00Z",
  sourceScheduleId: "schedule-1",
  items: [{
    portfolioItemId: "run:item",
    status: "completed",
    actualStart: "2027-02-02T00:00:00Z",
    actualFinish: "2027-02-20T00:00:00Z",
    actualCapacityDays: 24,
  }],
  ...overrides,
});

const adoption = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "adoption-1",
  asOf: "2027-02-01T12:00:00Z",
  status: "approved_estimate_basis",
  sourceScheduleId: "schedule-1",
  applications: [{
    portfolioItemId: "run:item",
    referenceClass: "onboarding",
    baseDurationDays: 6,
    baseCapacityDays: 20,
    scheduledDurationDays: 12,
    scheduledCapacityDays: 24,
    exception: null,
    evidenceIds: ["feedback-1"],
  }],
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "effectiveness-1",
  asOf: "2027-03-01T00:00:00Z",
  maximumDurationErrorRate: 0.2,
  maximumCapacityErrorRate: 0.2,
  minimumErrorReductionRate: 0.05,
  outcomes: [{
    portfolioItemId: "run:item",
    actualDurationDays: 12,
    evidence: "Reviewed time record workdays-44 supports twelve active delivery days.",
  }],
  review: {
    reviewer: "Estimation council",
    decision: "retain",
    rationale: "The calibrated basis reduced error and remained within both tolerances.",
    reviewedAt: "2027-03-01T01:00:00Z",
  },
  ...overrides,
});

test("verifies effective calibration against completed outcomes", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input());
  assert.equal(report.status, "verified_effectiveness");
  assert.equal(report.summary.meanBaseDurationErrorRate, 0.5);
  assert.equal(report.summary.meanCalibratedDurationErrorRate, 0);
  assert.equal(report.summary.meanCapacityErrorReductionRate, 0.1667);
});

test("blocks retention when calibrated estimates miss tolerance", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery({
    items: [{ ...delivery().items[0], actualCapacityDays: 40 }],
  }), adoption(), input({
    outcomes: [{ ...input().outcomes[0], actualDurationDays: 20 }],
  }));
  assert.equal(report.status, "blocked_retention");
  assert.equal(report.checks.find((entry) => entry.id === "accuracy-thresholds").passed, false);
});

test("detects calibrated estimates that regress from base estimates", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery({
    items: [{ ...delivery().items[0], actualCapacityDays: 20 }],
  }), adoption(), input({
    outcomes: [{ ...input().outcomes[0], actualDurationDays: 6 }],
  }));
  assert.equal(report.status, "blocked_retention");
  assert.equal(report.items[0].improved, false);
});

test("evaluates approved exception outcomes without claiming causality", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({
    applications: [{
      ...adoption().applications[0],
      exception: { reviewer: "Independent assurance", rationale: "Verified component reuse." },
    }],
  }), input());
  assert.equal(report.summary.exceptionItems, 1);
  assert.equal(report.items[0].exceptionOutcomeAcceptable, true);
});

test("blocks an exception outcome outside tolerance", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({
    applications: [{
      ...adoption().applications[0],
      exception: { reviewer: "Independent assurance", rationale: "Verified component reuse." },
    }],
  }), input({ outcomes: [{ ...input().outcomes[0], actualDurationDays: 20 }] }));
  assert.equal(report.checks.find((entry) => entry.id === "exception-outcomes").passed, false);
});

test("requires completed delivery evidence", () => {
  const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery({
    items: [{ ...delivery().items[0], status: "in_progress" }],
  }), adoption(), input());
  assert.equal(report.status, "blocked_retention");
  assert.equal(report.checks.find((entry) => entry.id === "completed-outcomes").passed, false);
});

test("requires matching schedule lineage", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery({ sourceScheduleId: "other" }), adoption(), input()), /matching Project 41/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({ sourceScheduleId: "other" }), input()), /matching approved Project 45/);
});

test("requires exact item coverage without duplicates", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({ outcomes: [] })), /exactly one reviewed outcome/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery({ items: [] }), adoption(), input()), /matching Project 41/);
});

test("rejects altered adopted estimates", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({
    applications: [{ ...adoption().applications[0], scheduledCapacityDays: 23 }],
  }), input()), /must reconcile/);
});

test("enforces adoption, delivery, and monitor chronology", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({ asOf: "2027-01-01T00:00:00Z" }), input()), /cannot precede/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery({ asOf: "2027-01-31T00:00:00Z" }), adoption(), input()), /must follow/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({ asOf: "2027-02-20T00:00:00Z" })), /cannot precede/);
});

test("requires reviewed workday outcomes and evidence", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({
    outcomes: [{ ...input().outcomes[0], actualDurationDays: 0 }],
  })), /actualDurationDays/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({
    outcomes: [{ ...input().outcomes[0], evidence: "" }],
  })), /outcome evidence/);
});

test("keeps adjust and collect-more decisions as human actions", () => {
  for (const decision of ["adjust", "collect_more"]) {
    const report = monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({
      review: { ...input().review, decision },
    }));
    assert.equal(report.status, "action_required");
  }
});

test("validates policy bounds and review chronology", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({ maximumDurationErrorRate: -1 })), /maximumDurationErrorRate/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({ minimumErrorReductionRate: 2 })), /minimumErrorReductionRate/);
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption(), input({
    review: { ...input().review, reviewedAt: "2027-02-28T00:00:00Z" },
  })), /cannot precede/);
});

test("requires an approved estimate basis", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness([], schedule(), delivery(), adoption({ status: "blocked_approval" }), input()), /approved Project 45/);
});

test("bounds product context", () => {
  assert.throws(() => monitorRoadmapEstimateEffectiveness(Array(51).fill({}), schedule(), delivery(), adoption(), input()), /at most 50/);
});
