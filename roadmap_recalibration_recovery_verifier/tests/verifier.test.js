import test from "node:test";
import assert from "node:assert/strict";
import { verifyRoadmapRecalibrationRecovery } from "../src/verifier.js";

const recalibration = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "recalibration-1",
  asOf: "2027-03-02T00:00:00Z",
  status: "approved_recalibration",
  activeVersion: "estimate-policy-3",
  proposedVersion: "estimate-policy-4",
  proposals: [{
    referenceClass: "onboarding",
    activeDurationFactor: 1.1,
    activeCapacityFactor: 1.2,
    candidateDurationFactor: 1.4,
    candidateCapacityFactor: 1.3,
    passed: true,
  }],
  ...overrides,
});

const rollout = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "rollout-1",
  asOf: "2027-03-10T00:00:00Z",
  status: "action_required",
  sourceRecalibrationId: "recalibration-1",
  activeVersion: "estimate-policy-3",
  proposedVersion: "estimate-policy-4",
  rollback: {
    targetVersion: "estimate-policy-3",
    owner: "Delivery operations",
    maximumRecoveryHours: 4,
  },
  review: {
    decision: "rollback",
    reviewedAt: "2027-03-10T01:00:00Z",
  },
  ...overrides,
});

const snapshot = (id, observedAt, overrides = {}) => ({
  id,
  observedAt,
  version: "estimate-policy-3",
  referenceClasses: [{
    referenceClass: "onboarding",
    sampleSize: 15,
    durationErrorRate: 0.1,
    capacityErrorRate: 0.1,
    incidents: 0,
    evidence: `Reviewed outcomes for ${id}.`,
  }],
  evidence: `Reviewed recovery snapshot ${id}.`,
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "recovery-1",
  asOf: "2027-03-13T12:00:00Z",
  minimumObservationHours: 48,
  maximumSnapshotGapHours: 48,
  minimumSamplesPerClass: 30,
  maximumDurationErrorRate: 0.15,
  maximumCapacityErrorRate: 0.15,
  maximumIncidents: 0,
  execution: {
    rollbackId: "rollback-change-1",
    authorizedAt: "2027-03-10T01:00:00Z",
    executedAt: "2027-03-10T03:00:00Z",
    fromVersion: "estimate-policy-4",
    toVersion: "estimate-policy-3",
    owner: "Delivery operations",
    recoveryHours: 2,
    evidence: "Reviewed change record confirms restoration of the prior policy.",
  },
  factorRestorations: [{
    referenceClass: "onboarding",
    durationFactor: 1.1,
    capacityFactor: 1.2,
    evidence: "Versioned configuration confirms the prior factors.",
  }],
  snapshots: [
    snapshot("recovery-24h", "2027-03-11T03:00:00Z"),
    snapshot("recovery-72h", "2027-03-13T03:00:00Z"),
  ],
  review: {
    reviewer: "Estimation council chair",
    decision: "close",
    rationale: "The approved version and factors are restored and stable.",
    reviewedAt: "2027-03-13T13:00:00Z",
  },
  ...overrides,
});

test("verifies an authorized and stable rollback recovery", () => {
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), input());
  assert.equal(result.status, "verified_recovery");
  assert.equal(result.summary.observationHours, 72);
  assert.equal(result.summary.totalSamples, 30);
  assert.equal(result.recoveredVersion, "estimate-policy-3");
});

test("requires an approved Project 48 recalibration", () => {
  assert.throws(
    () => verifyRoadmapRecalibrationRecovery(recalibration({ status: "blocked_recalibration" }), rollout(), input()),
    /approved Project 48/,
  );
});

test("requires a matching human Project 49 rollback decision", () => {
  assert.throws(
    () => verifyRoadmapRecalibrationRecovery(recalibration(), rollout({ review: { decision: "pause", reviewedAt: "2027-03-10T01:00:00Z" } }), input()),
    /human rollback decision/,
  );
});

test("requires matching upstream lineage", () => {
  assert.throws(
    () => verifyRoadmapRecalibrationRecovery(recalibration(), rollout({ sourceRecalibrationId: "other" }), input()),
    /matching Project 49/,
  );
});

test("requires execution after rollback authorization", () => {
  const value = input();
  value.execution.authorizedAt = "2027-03-09T00:00:00Z";
  assert.throws(() => verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value), /follow the Project 49/);
});

test("blocks an unapproved execution owner", () => {
  const value = input();
  value.execution.owner = "Unknown operator";
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.status, "blocked_close");
  assert.equal(result.checks.find((item) => item.id === "execution-owner").passed, false);
});

test("blocks recovery outside the approved time", () => {
  const value = input();
  value.execution.recoveryHours = 5;
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.status, "blocked_close");
});

test("blocks the wrong restored version", () => {
  const value = input();
  value.execution.toVersion = "estimate-policy-2";
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.checks.find((item) => item.id === "restored-version").passed, false);
});

test("blocks snapshots on the wrong version", () => {
  const value = input();
  value.snapshots[1].version = "estimate-policy-4";
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.status, "blocked_close");
});

test("blocks factors that do not match the pre-recalibration values", () => {
  const value = input();
  value.factorRestorations[0].durationFactor = 1.4;
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.factorRestorations[0].matchesPrior, false);
  assert.equal(result.status, "blocked_close");
});

test("requires exact reference-class restoration coverage", () => {
  const value = input();
  value.factorRestorations = [];
  assert.throws(() => verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value), /cover every/);
});

test("blocks an immature observation window", () => {
  const result = verifyRoadmapRecalibrationRecovery(
    recalibration(),
    rollout(),
    input({ minimumObservationHours: 73 }),
  );
  assert.equal(result.status, "blocked_close");
});

test("blocks excessive snapshot gaps", () => {
  const result = verifyRoadmapRecalibrationRecovery(
    recalibration(),
    rollout(),
    input({ maximumSnapshotGapHours: 47 }),
  );
  assert.equal(result.checks.find((item) => item.id === "snapshot-cadence").passed, false);
});

test("rejects out-of-order recovery snapshots", () => {
  const value = input();
  value.snapshots.reverse();
  assert.throws(() => verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value), /chronological/);
});

test("blocks insufficient class samples", () => {
  const result = verifyRoadmapRecalibrationRecovery(
    recalibration(),
    rollout(),
    input({ minimumSamplesPerClass: 31 }),
  );
  assert.equal(result.referenceClasses[0].sufficient, false);
});

test("blocks restored accuracy outside policy", () => {
  const value = input();
  value.snapshots[1].referenceClasses[0].durationErrorRate = 0.3;
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.referenceClasses[0].accurate, false);
});

test("blocks incident guardrail breaches", () => {
  const value = input();
  value.snapshots[0].referenceClasses[0].incidents = 1;
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.summary.incidents, 1);
  assert.equal(result.status, "blocked_close");
});

test("keeps continue and escalate decisions human-controlled", () => {
  for (const decision of ["continue_monitoring", "escalate"]) {
    const value = input();
    value.review = { ...value.review, decision };
    assert.equal(
      verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value).status,
      "action_required",
    );
  }
});

test("does not infer close from passing checks", () => {
  const value = input();
  value.review = { ...value.review, decision: "continue_monitoring" };
  const result = verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value);
  assert.equal(result.summary.allChecksPassed, true);
  assert.equal(result.status, "action_required");
});

test("requires review after the verification cutoff", () => {
  const value = input();
  value.review.reviewedAt = "2027-03-13T00:00:00Z";
  assert.throws(() => verifyRoadmapRecalibrationRecovery(recalibration(), rollout(), value), /Review cannot precede/);
});
