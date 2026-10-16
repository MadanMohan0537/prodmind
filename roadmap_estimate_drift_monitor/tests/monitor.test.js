import test from "node:test";
import assert from "node:assert/strict";
import { monitorRoadmapEstimateDrift } from "../src/monitor.js";

const report = (id, asOf, overrides = {}) => ({
  schemaVersion: "1.0.0",
  id,
  asOf,
  status: "verified_effectiveness",
  sourceScheduleId: `schedule-${id}`,
  sourceDeliveryId: `delivery-${id}`,
  sourceAdoptionId: `adoption-${id}`,
  items: [{
    portfolioItemId: `item-${id}`,
    referenceClass: "onboarding",
    calibratedDurationErrorRate: 0.1,
    calibratedCapacityErrorRate: 0.08,
    durationErrorReductionRate: 0.2,
    capacityErrorReductionRate: 0.15,
    exception: null,
    customerEvidenceIds: [`feedback-${id}`],
    adoptionEvidenceIds: [`estimate-${id}`],
    outcomeEvidence: `Reviewed outcome evidence for ${id}.`,
  }],
  ...overrides,
});

const reports = () => [
  report("one", "2027-01-01T00:00:00Z"),
  report("two", "2027-01-08T00:00:00Z"),
  report("three", "2027-01-15T00:00:00Z"),
  report("four", "2027-01-22T00:00:00Z"),
];

const input = (overrides = {}) => ({
  id: "drift-1",
  asOf: "2027-01-23T00:00:00Z",
  baselineReportCount: 2,
  recentReportCount: 2,
  minimumItemsPerClass: 2,
  maximumAssessmentGapDays: 10,
  maximumReportAgeDays: 3,
  maximumDurationErrorRate: 0.2,
  maximumCapacityErrorRate: 0.2,
  maximumErrorIncreaseRate: 0.05,
  minimumErrorReductionRate: 0.1,
  minimumClassCoverageRate: 1,
  review: {
    reviewer: "Estimation council",
    decision: "retain",
    rationale: "Accuracy and improvement remain stable across both windows.",
    reviewedAt: "2027-01-23T01:00:00Z",
  },
  ...overrides,
});

test("retains a stable calibration across non-overlapping windows", () => {
  const result = monitorRoadmapEstimateDrift([], reports(), input());
  assert.equal(result.status, "stable_calibration");
  assert.equal(result.summary.stableClasses, 1);
  assert.deepEqual(result.recalibrationCandidates, []);
});

test("detects duration error drift", () => {
  const values = reports();
  values[2].items[0].calibratedDurationErrorRate = 0.19;
  values[3].items[0].calibratedDurationErrorRate = 0.2;
  const result = monitorRoadmapEstimateDrift([], values, input());
  assert.equal(result.status, "blocked_retention");
  assert.equal(result.referenceClasses[0].durationStable, false);
  assert.deepEqual(result.recalibrationCandidates, ["onboarding"]);
});

test("detects capacity error drift", () => {
  const values = reports();
  values[2].items[0].calibratedCapacityErrorRate = 0.16;
  values[3].items[0].calibratedCapacityErrorRate = 0.18;
  const result = monitorRoadmapEstimateDrift([], values, input());
  assert.equal(result.checks.find((entry) => entry.id === "capacity-stability").passed, false);
});

test("blocks when recent estimates no longer improve on base estimates", () => {
  const values = reports();
  for (const value of values.slice(2)) value.items[0].durationErrorReductionRate = 0.02;
  const result = monitorRoadmapEstimateDrift([], values, input());
  assert.equal(result.referenceClasses[0].improvementRetained, false);
  assert.equal(result.status, "blocked_retention");
});

test("requires reference classes in both windows", () => {
  const values = reports();
  for (const value of values.slice(2)) value.items[0].referenceClass = "payments";
  const result = monitorRoadmapEstimateDrift([], values, input());
  assert.equal(result.summary.classCoverageRate, 0);
  assert.equal(result.checks.find((entry) => entry.id === "reference-class-coverage").passed, false);
});

test("permits declared partial class coverage", () => {
  const values = reports();
  for (const value of values) value.items.push({
    ...value.items[0],
    portfolioItemId: `partial-${value.id}`,
    referenceClass: value.id === "four" ? "new-class" : "onboarding",
  });
  const result = monitorRoadmapEstimateDrift([], values, input({ minimumClassCoverageRate: 0.5 }));
  assert.equal(result.checks.find((entry) => entry.id === "reference-class-coverage").passed, true);
});

test("detects stale or gapped assessment evidence", () => {
  const stale = monitorRoadmapEstimateDrift([], reports(), input({
    asOf: "2027-02-10T00:00:00Z",
    review: { ...input().review, reviewedAt: "2027-02-10T01:00:00Z" },
  }));
  assert.equal(stale.checks.find((entry) => entry.id === "assessment-cadence").passed, false);
  const values = reports();
  values[3] = report("four", "2027-02-20T00:00:00Z");
  const gapped = monitorRoadmapEstimateDrift([], values, input({
    asOf: "2027-02-21T00:00:00Z",
    review: { ...input().review, reviewedAt: "2027-02-21T01:00:00Z" },
  }));
  assert.equal(gapped.summary.maximumObservedGapDays, 36);
});

test("requires strictly chronological unique reports", () => {
  const values = reports();
  values[1].asOf = values[0].asOf;
  assert.throws(() => monitorRoadmapEstimateDrift([], values, input()), /strictly chronological/);
  const duplicate = reports();
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => monitorRoadmapEstimateDrift([], duplicate, input()), /IDs must be unique/);
});

test("requires non-overlapping baseline and recent windows", () => {
  assert.throws(() => monitorRoadmapEstimateDrift([], reports(), input({ baselineReportCount: 3, recentReportCount: 2 })), /must not overlap/);
});

test("requires bounded Project 46 reports", () => {
  assert.throws(() => monitorRoadmapEstimateDrift([], reports().slice(0, 2), input()), /3–50/);
  const values = reports();
  values[0].schemaVersion = "2.0.0";
  assert.throws(() => monitorRoadmapEstimateDrift([], values, input()), /Project 46 report/);
});

test("requires complete source and item evidence lineage", () => {
  const values = reports();
  values[0].items[0].customerEvidenceIds = [];
  assert.throws(() => monitorRoadmapEstimateDrift([], values, input()), /must not be empty/);
});

test("reports recent exception volume without treating it as drift", () => {
  const values = reports();
  values[3].items[0].exception = { reviewer: "Independent assurance" };
  const result = monitorRoadmapEstimateDrift([], values, input());
  assert.equal(result.referenceClasses[0].exceptionItems, 1);
  assert.equal(result.status, "stable_calibration");
});

test("keeps investigate and recalibrate as human actions", () => {
  for (const decision of ["investigate", "recalibrate"]) {
    const result = monitorRoadmapEstimateDrift([], reports(), input({
      review: { ...input().review, decision },
    }));
    assert.equal(result.status, "action_required");
  }
});

test("validates policy and review chronology", () => {
  assert.throws(() => monitorRoadmapEstimateDrift([], reports(), input({ maximumErrorIncreaseRate: -1 })), /maximumErrorIncreaseRate/);
  assert.throws(() => monitorRoadmapEstimateDrift([], reports(), input({ minimumItemsPerClass: 0 })), /minimumItemsPerClass/);
  assert.throws(() => monitorRoadmapEstimateDrift([], reports(), input({ review: { ...input().review, reviewedAt: "2027-01-22T00:00:00Z" } })), /cannot precede/);
});

test("bounds product context", () => {
  assert.throws(() => monitorRoadmapEstimateDrift(Array(51).fill({}), reports(), input()), /at most 50/);
});
