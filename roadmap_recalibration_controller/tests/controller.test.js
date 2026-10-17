import test from "node:test";
import assert from "node:assert/strict";
import { controlRoadmapEstimateRecalibration } from "../src/controller.js";

const active = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "calibration-active",
  asOf: "2027-01-01T00:00:00Z",
  status: "adopted_calibration",
  referenceClasses: [{
    referenceClass: "onboarding",
    sufficient: true,
    recommendedDurationFactor: 1.1,
    recommendedCapacityFactor: 1.1,
    sourceCaseIds: ["delivery-old"],
  }],
  ...overrides,
});

const drift = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "drift-1",
  asOf: "2027-02-01T00:00:00Z",
  status: "action_required",
  recalibrationCandidates: ["onboarding"],
  review: { decision: "recalibrate" },
  ...overrides,
});

const observation = (id, deliveryAsOf, ratio = 1.4, overrides = {}) => ({
  portfolioItemId: id,
  referenceClass: "onboarding",
  plannedElapsedDays: 10,
  actualElapsedDays: 10 * ratio,
  plannedCapacityDays: 20,
  actualCapacityDays: 20 * ratio,
  deliveryAsOf,
  evidenceIds: [`feedback-${id}`],
  deliveryEvidence: `Reviewed delivery evidence for ${id}.`,
  basis: "Comparable onboarding implementation.",
  ...overrides,
});

const evidence = (overrides = {}) => ({
  schemaVersion: "1.0.0",
  id: "calibration-evidence",
  asOf: "2027-03-01T00:00:00Z",
  observations: [
    observation("one", "2027-02-02T00:00:00Z"),
    observation("two", "2027-02-06T00:00:00Z"),
    observation("three", "2027-02-10T00:00:00Z"),
    observation("four", "2027-02-14T00:00:00Z"),
    observation("five", "2027-02-18T00:00:00Z"),
    observation("six", "2027-02-22T00:00:00Z"),
  ],
  ...overrides,
});

const approvals = () => ({
  product: {
    reviewer: "Product lead",
    decision: "approve",
    rationale: "The proposal is scoped to the detected class.",
    reviewedAt: "2027-03-02T01:00:00Z",
  },
  engineering: {
    reviewer: "Engineering lead",
    decision: "approve",
    rationale: "Version and rollback controls are executable.",
    reviewedAt: "2027-03-02T01:05:00Z",
  },
  assurance: {
    reviewer: "Independent assurance",
    decision: "approve",
    rationale: "The temporal holdout remains separate.",
    reviewedAt: "2027-03-02T01:10:00Z",
  },
});

const input = (overrides = {}) => ({
  id: "recalibration-1",
  asOf: "2027-03-02T00:00:00Z",
  activeVersion: "estimate-policy-3",
  proposedVersion: "estimate-policy-4",
  validUntil: "2027-04-01T00:00:00Z",
  minimumTrainingItemsPerClass: 4,
  holdoutItemsPerClass: 2,
  percentileRate: 0.75,
  maximumFactorChangeRate: 0.5,
  minimumHoldoutImprovementRate: 0.05,
  maximumHoldoutErrorRate: 0.15,
  rollback: {
    targetVersion: "estimate-policy-3",
    owner: "Delivery operations",
    maximumRecoveryHours: 4,
    evidence: "Previous policy bundle remains deployable.",
  },
  approvals: approvals(),
  review: {
    reviewer: "Estimation council chair",
    decision: "approve",
    rationale: "The candidate improves untouched evidence and is reversible.",
    reviewedAt: "2027-03-02T02:00:00Z",
  },
  ...overrides,
});

test("approves a bounded recalibration that improves a later holdout", () => {
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input());
  assert.equal(result.status, "approved_recalibration");
  assert.equal(result.proposals[0].candidateDurationFactor, 1.4);
  assert.equal(result.proposals[0].trainingSamples, 4);
  assert.equal(result.proposals[0].holdoutSamples, 2);
  assert.equal(result.summary.approvedCandidates, 1);
});

test("keeps the temporal holdout out of factor construction", () => {
  const changed = evidence();
  changed.observations[4].actualElapsedDays = 15;
  changed.observations[5].actualElapsedDays = 15;
  const result = controlRoadmapEstimateRecalibration(active(), drift(), changed, input({ maximumHoldoutErrorRate: 0.2 }));
  assert.equal(result.proposals[0].candidateDurationFactor, 1.4);
  assert.deepEqual(result.proposals[0].trainingObservationIds, ["one", "two", "three", "four"]);
});

test("blocks insufficient training evidence", () => {
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence({ observations: evidence().observations.slice(0, 4) }), input());
  assert.equal(result.status, "blocked_recalibration");
  assert.equal(result.proposals[0].sufficient, false);
});

test("blocks a factor change above the declared limit", () => {
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ maximumFactorChangeRate: 0.1 }));
  assert.equal(result.status, "blocked_recalibration");
  assert.equal(result.proposals[0].bounded, false);
});

test("blocks a candidate that misses holdout accuracy", () => {
  const rows = evidence().observations;
  rows[4] = observation("five", "2027-02-18T00:00:00Z", 2);
  rows[5] = observation("six", "2027-02-22T00:00:00Z", 2);
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence({ observations: rows }), input());
  assert.equal(result.proposals[0].accurate, false);
  assert.equal(result.status, "blocked_recalibration");
});

test("blocks a candidate without the required holdout improvement", () => {
  const result = controlRoadmapEstimateRecalibration(
    active({ referenceClasses: [{ referenceClass: "onboarding", sufficient: true, recommendedDurationFactor: 1.4, recommendedCapacityFactor: 1.4, sourceCaseIds: ["old"] }] }),
    drift(),
    evidence(),
    input(),
  );
  assert.equal(result.proposals[0].improved, false);
  assert.equal(result.status, "blocked_recalibration");
});

test("requires Project 47 recalibration authorization", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift({ review: { decision: "investigate" } }), evidence(), input()), /recalibration decision/);
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift({ status: "stable_calibration" }), evidence(), input()), /recalibration decision/);
});

test("requires every candidate to exist in the active calibration", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift({ recalibrationCandidates: ["payments"] }), evidence(), input()), /active calibration/);
});

test("requires distinct active and evidence calibration reports", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence({ id: "calibration-active" }), input()), /distinct/);
});

test("rejects duplicate observation IDs", () => {
  const rows = evidence().observations;
  rows[1].portfolioItemId = rows[0].portfolioItemId;
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence({ observations: rows }), input()), /IDs must be unique/);
});

test("requires evidence chronology", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence({ asOf: "2027-01-20T00:00:00Z" }), input()), /cannot precede/);
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ asOf: "2027-02-20T00:00:00Z" })), /cannot precede/);
});

test("requires a new version and bounded validity window", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ proposedVersion: "estimate-policy-3" })), /must differ/);
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ validUntil: "2028-01-01T00:00:00Z" })), /1–180 days/);
});

test("requires rollback to the active version", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ rollback: { ...input().rollback, targetVersion: "estimate-policy-2" } })), /activeVersion/);
});

test("requires distinct approval reviewers", () => {
  const values = approvals();
  values.assurance.reviewer = values.product.reviewer;
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ approvals: values }));
  assert.equal(result.checks.find((entry) => entry.id === "independent-approval").passed, false);
  assert.equal(result.status, "blocked_recalibration");
});

test("requires every approval before approval", () => {
  const values = approvals();
  values.engineering.decision = "reject";
  const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ approvals: values }));
  assert.equal(result.status, "blocked_recalibration");
});

test("keeps revise and defer as human decisions", () => {
  for (const decision of ["revise", "defer"]) {
    const result = controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ review: { ...input().review, decision } }));
    assert.equal(result.status, "action_required");
  }
});

test("requires complete observation lineage", () => {
  const rows = evidence().observations;
  rows[0].evidenceIds = [];
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence({ observations: rows }), input()), /must not be empty/);
});

test("validates policy ranges and review chronology", () => {
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ percentileRate: 0.2 })), /percentileRate/);
  assert.throws(() => controlRoadmapEstimateRecalibration(active(), drift(), evidence(), input({ review: { ...input().review, reviewedAt: "2027-03-01T00:00:00Z" } })), /cannot precede/);
});
