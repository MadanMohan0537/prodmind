import test from "node:test";
import assert from "node:assert/strict";
import { monitorRoadmapRecalibrationRollout } from "../src/monitor.js";

const proposal = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "recalibration-1",
  asOf: "2027-03-02T00:00:00Z",
  status: "approved_recalibration",
  activeVersion: "estimate-policy-3",
  proposedVersion: "estimate-policy-4",
  validUntil: "2027-04-01T00:00:00Z",
  proposals: [{
    referenceClass: "onboarding",
    candidateDurationFactor: 1.4,
    candidateCapacityFactor: 1.3,
    passed: true,
  }],
  rollback: { targetVersion: "estimate-policy-3", maximumRecoveryHours: 4 },
  review: { decision: "approve" },
  ...overrides,
});

const observation = (overrides = {}) => ({
  referenceClass: "onboarding",
  sampleSize: 10,
  activeDurationErrorRate: 0.3,
  candidateDurationErrorRate: 0.1,
  activeCapacityErrorRate: 0.25,
  candidateCapacityErrorRate: 0.08,
  candidateDurationFactor: 1.4,
  candidateCapacityFactor: 1.3,
  incidents: 0,
  evidence: "Reviewed paired estimate and outcome cohort.",
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "rollout-1",
  asOf: "2027-03-10T00:00:00Z",
  minimumStageDwellHours: 24,
  minimumSamplesPerClass: 30,
  maximumExposureRate: 0.5,
  maximumCandidateErrorRate: 0.15,
  minimumImprovementRate: 0.05,
  maximumIncidents: 0,
  declaration: {
    owner: "Delivery operations",
    declaredAt: "2027-03-02T12:00:00Z",
    baselineVersion: "estimate-policy-3",
    targetVersion: "estimate-policy-4",
    evidence: "Approved rollout record names the exact versions and owner.",
  },
  stages: [
    {
      id: "shadow",
      mode: "shadow",
      exposureRate: 0,
      version: "estimate-policy-4",
      startedAt: "2027-03-03T00:00:00Z",
      endedAt: "2027-03-04T00:00:00Z",
      observations: [observation()],
      evidence: "Shadow calculations were retained without changing live estimates.",
    },
    {
      id: "canary-10",
      mode: "active",
      exposureRate: 0.1,
      version: "estimate-policy-4",
      startedAt: "2027-03-05T00:00:00Z",
      endedAt: "2027-03-06T00:00:00Z",
      observations: [observation()],
      evidence: "Ten-percent stage cohort and comparison were reviewed.",
    },
    {
      id: "canary-50",
      mode: "active",
      exposureRate: 0.5,
      version: "estimate-policy-4",
      startedAt: "2027-03-07T00:00:00Z",
      endedAt: "2027-03-08T00:00:00Z",
      observations: [observation()],
      evidence: "Fifty-percent stage cohort and comparison were reviewed.",
    },
  ],
  rollback: {
    targetVersion: "estimate-policy-3",
    owner: "Delivery operations",
    testedAt: "2027-03-09T00:00:00Z",
    maximumRecoveryHours: 4,
    evidence: "A reviewed exercise restored the prior policy bundle.",
  },
  review: {
    reviewer: "Estimation council chair",
    decision: "promote",
    rationale: "All shadow and staged rollout gates pass.",
    reviewedAt: "2027-03-10T01:00:00Z",
  },
  ...overrides,
});

test("verifies an evidence-backed shadow and staged rollout", () => {
  const result = monitorRoadmapRecalibrationRollout(proposal(), input());
  assert.equal(result.status, "verified_rollout");
  assert.equal(result.summary.totalSamples, 30);
  assert.equal(result.referenceClasses[0].durationImprovementRate, 0.2);
  assert.equal(result.summary.allChecksPassed, true);
});

test("blocks an unapproved Project 48 report", () => {
  assert.throws(
    () => monitorRoadmapRecalibrationRollout(proposal({ status: "blocked_recalibration" }), input()),
    /approved Project 48/,
  );
});

test("requires a shadow stage first", () => {
  const value = input();
  value.stages[0] = { ...value.stages[0], mode: "active", exposureRate: 0.05 };
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /first rollout stage/);
});

test("rejects overlapping stages", () => {
  const value = input();
  value.stages[1].startedAt = "2027-03-03T12:00:00Z";
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /must not overlap/);
});

test("rejects non-increasing active exposure", () => {
  const value = input();
  value.stages[2].exposureRate = 0.1;
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /increase strictly/);
});

test("blocks a wrong target version without throwing", () => {
  const value = input();
  value.stages[1].version = "estimate-policy-5";
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.status, "blocked_promotion");
  assert.equal(result.checks.find((item) => item.id === "target-version").passed, false);
});

test("blocks factors that differ from the approved proposal", () => {
  const value = input();
  value.stages[2].observations[0].candidateDurationFactor = 1.5;
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.status, "blocked_promotion");
  assert.equal(result.referenceClasses[0].factorsMatch, false);
});

test("blocks stages shorter than minimum dwell", () => {
  const value = input();
  value.stages[1].endedAt = "2027-03-05T12:00:00Z";
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.checks.find((item) => item.id === "minimum-dwell").passed, false);
});

test("blocks insufficient paired samples", () => {
  const result = monitorRoadmapRecalibrationRollout(proposal(), input({ minimumSamplesPerClass: 31 }));
  assert.equal(result.status, "blocked_promotion");
  assert.equal(result.referenceClasses[0].sufficient, false);
});

test("blocks candidate error above the ceiling", () => {
  const value = input();
  value.stages[2].observations[0].candidateDurationErrorRate = 0.4;
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.referenceClasses[0].accurate, false);
  assert.equal(result.status, "blocked_promotion");
});

test("blocks a candidate without paired improvement", () => {
  const value = input();
  value.stages.forEach((stage) => {
    stage.observations[0].activeDurationErrorRate = 0.1;
    stage.observations[0].candidateDurationErrorRate = 0.1;
  });
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.referenceClasses[0].improved, false);
});

test("blocks an incident guardrail breach", () => {
  const value = input();
  value.stages[1].observations[0].incidents = 1;
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.summary.incidents, 1);
  assert.equal(result.status, "blocked_promotion");
});

test("requires an exact approved rollback target", () => {
  const value = input();
  value.rollback.targetVersion = "estimate-policy-2";
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.checks.find((item) => item.id === "tested-rollback").passed, false);
});

test("blocks a rollback slower than Project 48 allowed", () => {
  const value = input();
  value.rollback.maximumRecoveryHours = 5;
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.status, "blocked_promotion");
});

test("requires rollback testing within the review window", () => {
  const value = input();
  value.rollback.testedAt = "2027-03-01T00:00:00Z";
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /Rollback test/);
});

test("requires rollout start before proposal expiry", () => {
  const value = input();
  value.stages = value.stages.map((stage, index) => ({
    ...stage,
    startedAt: `2027-04-${String(2 + index * 2).padStart(2, '0')}T00:00:00Z`,
    endedAt: `2027-04-${String(3 + index * 2).padStart(2, '0')}T00:00:00Z`,
  }));
  value.asOf = "2027-04-10T00:00:00Z";
  value.review = { ...value.review, reviewedAt: "2027-04-10T01:00:00Z" };
  value.rollback = { ...value.rollback, testedAt: "2027-04-09T00:00:00Z" };
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.checks.find((item) => item.id === "valid-start").passed, false);
});

test("requires exact and complete class coverage", () => {
  const value = input();
  value.stages[0].observations = [];
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /every approved reference class/);
});

test("keeps pause and rollback decisions as human action required", () => {
  for (const decision of ["pause", "rollback"]) {
    const value = input();
    value.review = { ...value.review, decision };
    assert.equal(monitorRoadmapRecalibrationRollout(proposal(), value).status, "action_required");
  }
});

test("does not infer promotion from passing checks", () => {
  const value = input();
  value.review = { ...value.review, decision: "pause" };
  const result = monitorRoadmapRecalibrationRollout(proposal(), value);
  assert.equal(result.summary.allChecksPassed, true);
  assert.equal(result.status, "action_required");
});

test("rejects reviews before the monitoring cutoff", () => {
  const value = input();
  value.review = { ...value.review, reviewedAt: "2027-03-09T00:00:00Z" };
  assert.throws(() => monitorRoadmapRecalibrationRollout(proposal(), value), /Review cannot precede/);
});
