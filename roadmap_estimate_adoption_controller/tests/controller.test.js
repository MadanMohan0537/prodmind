import test from "node:test";
import assert from "node:assert/strict";
import { controlRoadmapEstimateAdoption } from "../src/controller.js";

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
    estimateBasis: "Six base workdays adjusted by the adopted onboarding reference class.",
    evidenceIds: ["feedback-1"],
  }],
  review: { reviewer: "Roadmap council" },
  ...overrides,
});

const calibration = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "calibration-1",
  asOf: "2027-01-20T00:00:00Z",
  status: "adopted_calibration",
  referenceClasses: [{
    referenceClass: "onboarding",
    sufficient: true,
    sampleSize: 4,
    recommendedDurationFactor: 2,
    recommendedCapacityFactor: 1.2,
  }],
  review: { reviewer: "Calibration council" },
  ...overrides,
});

const application = (overrides = {}) => ({
  portfolioItemId: "run:item",
  referenceClass: "onboarding",
  baseDurationDays: 6,
  baseCapacityDays: 20,
  appliedDurationFactor: 2,
  appliedCapacityFactor: 1.2,
  estimateBasis: "Applied the adopted factors to an independently reviewed base estimate.",
  evidence: "Estimate worksheet estimate-27 records the base values and arithmetic.",
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "control-1",
  asOf: "2027-02-01T12:00:00Z",
  maximumCalibrationAgeDays: 90,
  roundingToleranceDays: 0,
  capacityToleranceRate: 0,
  applications: [application()],
  review: {
    reviewer: "Investment committee",
    decision: "approve",
    rationale: "Every estimate reconciles to an adopted factor or approved exception.",
    reviewedAt: "2027-02-01T13:00:00Z",
  },
  ...overrides,
});

test("approves a reconciled estimate basis", () => {
  const report = controlRoadmapEstimateAdoption([], schedule(), calibration(), input());
  assert.equal(report.status, "approved_estimate_basis");
  assert.equal(report.summary.compliantItems, 1);
  assert.equal(report.applications[0].expectedCapacityDays, 24);
});

test("blocks approval when a factor is below the recommendation", () => {
  const report = controlRoadmapEstimateAdoption([], schedule({ schedule: [{ ...schedule().schedule[0], durationDays: 9 }] }), calibration(), input({
    applications: [application({ appliedDurationFactor: 1.5 })],
  }));
  assert.equal(report.status, "blocked_approval");
  assert.equal(report.checks.find((entry) => entry.id === "factor-or-exception-control").passed, false);
});

test("accepts a prior independent exception to a lower factor", () => {
  const exception = {
    reviewer: "Independent assurance",
    decision: "approve",
    rationale: "The item reuses a verified component and requires a lower factor.",
    evidence: "Architecture evidence arch-44 demonstrates verified reuse.",
    reviewedAt: "2027-01-31T00:00:00Z",
  };
  const report = controlRoadmapEstimateAdoption([], schedule({ schedule: [{ ...schedule().schedule[0], durationDays: 9 }] }), calibration(), input({
    applications: [application({ baseCapacityDays: 15, appliedDurationFactor: 1.5, exception })],
  }));
  assert.equal(report.status, "approved_estimate_basis");
  assert.equal(report.summary.exceptionItems, 1);
});

test("requires independent exception review", () => {
  const exception = { reviewer: "Roadmap council", decision: "approve", rationale: "A justified exception.", evidence: "Evidence record.", reviewedAt: "2027-01-31T00:00:00Z" };
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: [application({ appliedDurationFactor: 1.5, exception })] })), /must be independent/);
});

test("requires exceptions before schedule approval", () => {
  const exception = { reviewer: "Independent assurance", decision: "approve", rationale: "A justified exception.", evidence: "Evidence record.", reviewedAt: "2027-02-02T00:00:00Z" };
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: [application({ appliedDurationFactor: 1.5, exception })] })), /no later than Project 40 asOf/);
});

test("rejects unnecessary exceptions", () => {
  const exception = { reviewer: "Independent assurance", decision: "approve", rationale: "Not needed.", evidence: "Evidence record.", reviewedAt: "2027-01-31T00:00:00Z" };
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: [application({ exception })] })), /unnecessary/);
});

test("requires exact application coverage", () => {
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: [] })), /exactly one estimate application/);
  const duplicate = [application(), application()];
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: duplicate })), /exactly one estimate application/);
});

test("requires a prior adopted calibration", () => {
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration({ status: "blocked_adoption" }), input()), /adopted Project 44/);
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration({ asOf: "2027-02-02T00:00:00Z" }), input()), /must exist before/);
});

test("blocks stale calibration evidence", () => {
  const report = controlRoadmapEstimateAdoption([], schedule(), calibration({ asOf: "2026-01-01T00:00:00Z" }), input());
  assert.equal(report.status, "blocked_approval");
  assert.equal(report.checks.find((entry) => entry.id === "calibration-freshness").passed, false);
});

test("blocks unknown or insufficient reference classes", () => {
  const unknown = controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ applications: [application({ referenceClass: "unknown" })] }));
  assert.equal(unknown.status, "blocked_approval");
  const insufficient = controlRoadmapEstimateAdoption([], schedule(), calibration({ referenceClasses: [{ ...calibration().referenceClasses[0], sufficient: false, recommendedDurationFactor: null, recommendedCapacityFactor: null }] }), input());
  assert.equal(insufficient.summary.unusableClasses, 1);
});

test("reconciles duration and capacity arithmetic", () => {
  const report = controlRoadmapEstimateAdoption([], schedule({ schedule: [{ ...schedule().schedule[0], durationDays: 11 }] }), calibration(), input({ capacityToleranceRate: 0.1 }));
  assert.equal(report.status, "blocked_approval");
  assert.equal(report.summary.unreconciledItems, 1);
});

test("applies declared rounding tolerances", () => {
  const report = controlRoadmapEstimateAdoption([], schedule({ schedule: [{ ...schedule().schedule[0], durationDays: 13 }] }), calibration(), input({ roundingToleranceDays: 1, capacityToleranceRate: 0.1 }));
  assert.equal(report.status, "approved_estimate_basis");
});

test("keeps revise and defer as human actions", () => {
  for (const decision of ["revise", "defer"])
    assert.equal(controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ review: { ...input().review, decision } })).status, "action_required");
});

test("validates policy and review chronology", () => {
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ maximumCalibrationAgeDays: 0 })), /maximumCalibrationAgeDays/);
  assert.throws(() => controlRoadmapEstimateAdoption([], schedule(), calibration(), input({ review: { ...input().review, reviewedAt: "2027-01-31T00:00:00Z" } })), /cannot precede/);
});

test("bounds product context", () => {
  assert.throws(() => controlRoadmapEstimateAdoption(Array(51).fill({}), schedule(), calibration(), input()), /at most 50/);
});
