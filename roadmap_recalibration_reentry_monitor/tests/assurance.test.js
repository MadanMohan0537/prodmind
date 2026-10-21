import assert from "node:assert/strict";
import test from "node:test";
import { assureRoadmapRecalibrationReentry } from "../src/assurance.js";

const learning = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "learning-1",
  asOf: "2027-03-21T00:00:00Z",
  status: "ready_for_reentry",
  sourceRecoveryId: "recovery-1",
  sourceRecalibrationId: "recalibration-1",
  sourceRolloutId: "rollout-1",
  recoveredVersion: "estimate-policy-3",
  failedVersion: "estimate-policy-4",
  contributingConditions: [{ id: "condition-1" }],
  actions: [
    { id: "prevent-1", type: "prevent", priority: "p1", status: "completed" },
    { id: "detect-1", type: "detect", priority: "p2", status: "completed" },
  ],
  reentry: {
    owner: "Delivery operations",
    baselineVersion: "estimate-policy-3",
    candidateVersion: "estimate-policy-5",
    scope: ["onboarding"],
    startsAt: "2027-03-28T13:00:00Z",
    shadowRequired: true,
    initialExposureRate: 0.05,
    requiredActionIds: ["prevent-1", "detect-1"],
    rollback: {
      targetVersion: "estimate-policy-3",
      owner: "Delivery operations",
      maximumRecoveryHours: 4,
    },
    monitors: ["duration_error", "capacity_error", "incidents"],
  },
  approvals: [
    { reviewer: "Product reviewer" },
    { reviewer: "Delivery reviewer" },
    { reviewer: "Governance reviewer" },
  ],
  review: {
    reviewer: "Re-entry council",
    decision: "approve_reentry",
  },
  ...overrides,
});

function classObservation(overrides = {}) {
  return {
    referenceClass: "onboarding",
    sampleSize: 20,
    baselineDurationErrorRate: 0.2,
    candidateDurationErrorRate: 0.1,
    baselineCapacityErrorRate: 0.2,
    candidateCapacityErrorRate: 0.1,
    incidents: 0,
    evidence: "Reviewed paired estimate outcomes.",
    ...overrides,
  };
}

function stage(id, mode, exposureRate, startedAt, endedAt, overrides = {}) {
  return {
    id,
    mode,
    exposureRate,
    version: "estimate-policy-5",
    startedAt,
    endedAt,
    classObservations: [classObservation()],
    recurrenceSignals: [{
      conditionId: "condition-1",
      detected: false,
      evidence: "Cohort monitor remained clear.",
    }],
    actionControls: [
      { actionId: "prevent-1", operational: true, evidence: "Coverage gate passed." },
      { actionId: "detect-1", operational: true, evidence: "Alert exercise passed." },
    ],
    evidence: `Reviewed ${id} execution record.`,
    ...overrides,
  };
}

const input = (overrides = {}) => ({
  id: "assurance-1",
  asOf: "2027-03-30T13:00:00Z",
  minimumStageDwellHours: 24,
  maximumStageGapHours: 2,
  minimumSamplesPerClass: 30,
  maximumExposureRate: 0.05,
  maximumCandidateErrorRate: 0.15,
  minimumImprovementRate: 0.05,
  maximumIncidents: 0,
  declaration: {
    sourceLearningId: "learning-1",
    owner: "Delivery operations",
    baselineVersion: "estimate-policy-3",
    candidateVersion: "estimate-policy-5",
    scope: ["onboarding"],
    declaredAt: "2027-03-27T13:00:00Z",
    evidence: "Approved re-entry record and exposure plan.",
  },
  stages: [
    stage(
      "shadow",
      "shadow",
      0,
      "2027-03-28T13:00:00Z",
      "2027-03-29T13:00:00Z",
    ),
    stage(
      "active-5",
      "active",
      0.05,
      "2027-03-29T13:00:00Z",
      "2027-03-30T13:00:00Z",
    ),
  ],
  rollback: {
    targetVersion: "estimate-policy-3",
    owner: "Delivery operations",
    testedAt: "2027-03-25T00:00:00Z",
    maximumRecoveryHours: 4,
    evidence: "Recovery drill restored the recovered baseline.",
  },
  review: {
    reviewer: "Independent assurance lead",
    decision: "continue",
    rationale: "Bounded re-entry remained within every declared control.",
    reviewedAt: "2027-03-30T14:00:00Z",
  },
  ...overrides,
});

test("verifies a bounded re-entry with complete lineage", () => {
  const result = assureRoadmapRecalibrationReentry(learning(), input());
  assert.equal(result.status, "verified_reentry");
  assert.equal(result.sourceLearningId, "learning-1");
  assert.equal(result.summary.samples, 40);
  assert.ok(result.checks.every((item) => item.passed));
});

test("blocks an unapproved Project 51 report", () => {
  const result = assureRoadmapRecalibrationReentry(
    learning({ status: "blocked_reentry" }),
    input(),
  );
  assert.equal(result.status, "blocked_continue");
});

test("blocks Project 51 without human approval", () => {
  const result = assureRoadmapRecalibrationReentry(learning({
    review: { reviewer: "Re-entry council", decision: "continue_freeze" },
  }), input());
  assert.equal(result.status, "blocked_continue");
});

test("requires an exact declaration", () => {
  const value = input();
  value.declaration.candidateVersion = "estimate-policy-6";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("requires declaration before exposure", () => {
  const value = input();
  value.declaration.declaredAt = "2027-03-29T00:00:00Z";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("requires the approved start time", () => {
  const value = input();
  value.stages[0].startedAt = "2027-03-28T12:00:00Z";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("blocks a wrong candidate version", () => {
  const value = input();
  value.stages[1].version = "estimate-policy-4";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("blocks exposure above Project 51 authorization", () => {
  const value = input({ maximumExposureRate: 0.1 });
  value.stages[1].exposureRate = 0.06;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("requires shadow before active exposure", () => {
  const value = input();
  value.stages[0].mode = "active";
  value.stages[0].exposureRate = 0.01;
  assert.throws(
    () => assureRoadmapRecalibrationReentry(learning(), value),
    /shadow stage/,
  );
});

test("blocks insufficient stage dwell", () => {
  const value = input();
  value.stages[0].endedAt = "2027-03-29T12:00:00Z";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("blocks excessive inter-stage gaps", () => {
  const value = input({ maximumStageGapHours: 0 });
  value.stages[1].startedAt = "2027-03-29T14:00:00Z";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("blocks insufficient samples", () => {
  const result = assureRoadmapRecalibrationReentry(
    learning(),
    input({ minimumSamplesPerClass: 41 }),
  );
  assert.equal(result.referenceClasses[0].sufficient, false);
  assert.equal(result.status, "blocked_continue");
});

test("blocks candidate error above policy", () => {
  const value = input();
  value.stages[1].classObservations[0].candidateDurationErrorRate = 0.3;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.referenceClasses[0].accurate, false);
});

test("blocks a candidate without paired improvement", () => {
  const value = input();
  value.stages[0].classObservations[0].candidateCapacityErrorRate = 0.2;
  value.stages[1].classObservations[0].candidateCapacityErrorRate = 0.2;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.referenceClasses[0].improved, false);
});

test("blocks a failed corrective control", () => {
  const value = input();
  value.stages[1].actionControls[0].operational = false;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("blocks recurrence of a contributing condition", () => {
  const value = input();
  value.stages[1].recurrenceSignals[0].detected = true;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.summary.recurrenceSignals, 1);
  assert.equal(result.status, "blocked_continue");
});

test("blocks an incident guardrail breach", () => {
  const value = input();
  value.stages[1].classObservations[0].incidents = 1;
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.summary.incidents, 1);
  assert.equal(result.status, "blocked_continue");
});

test("requires rollback to the recovered baseline", () => {
  const value = input();
  value.rollback.targetVersion = "estimate-policy-2";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("requires an independent assurance reviewer", () => {
  const value = input();
  value.review.reviewer = "Product reviewer";
  const result = assureRoadmapRecalibrationReentry(learning(), value);
  assert.equal(result.status, "blocked_continue");
});

test("keeps pause and rollback as named human actions", () => {
  for (const decision of ["pause", "rollback"]) {
    const value = input();
    value.review = { ...value.review, decision };
    const result = assureRoadmapRecalibrationReentry(learning(), value);
    assert.equal(result.status, "action_required");
    assert.equal(result.summary.allChecksPassed, true);
  }
});

test("rejects malformed upstream reports and invalid policy", () => {
  assert.throws(
    () => assureRoadmapRecalibrationReentry({}, input()),
    /Project 51/,
  );
  assert.throws(
    () => assureRoadmapRecalibrationReentry(learning(), input({ maximumStageGapHours: -1 })),
    /0 to 168/,
  );
});
