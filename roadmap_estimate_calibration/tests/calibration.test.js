import test from "node:test";
import assert from "node:assert/strict";
import { calibrateRoadmapEstimates } from "../src/calibration.js";

const item = (id, overrides = {}) => ({
  portfolioItemId: id, title: `Item ${id}`, teamId: "product", durationDays: 2, capacity: 1,
  start: "2027-01-04", finish: "2027-01-05", deadline: "2027-01-08", evidenceIds: [`evidence-${id}`],
  ...overrides,
});
const schedule = (id, scheduleItems = [item(`${id}:a`)]) => ({ schemaVersion: "1.0.0", id, status: "approved_schedule", schedule: scheduleItems });
const delivery = (id, scheduleReport, overrides = {}) => ({
  schemaVersion: "1.0.0", id, asOf: "2027-01-10T00:00:00Z", sourceScheduleId: scheduleReport.id,
  items: scheduleReport.schedule.map((entry) => ({
    portfolioItemId: entry.portfolioItemId, status: "completed", actualStart: entry.start, actualFinish: entry.finish,
    actualCapacityDays: entry.durationDays * entry.capacity, deadlineMet: true, evidence: `Delivery evidence for ${entry.portfolioItemId}.`,
  })), ...overrides,
});
const oneCase = (id, overrides = {}) => {
  const scheduleReport = schedule(`schedule-${id}`);
  return { scheduleReport, deliveryReport: delivery(`delivery-${id}`, scheduleReport), classifications: [{ portfolioItemId: `${`schedule-${id}`}:a`, referenceClass: "onboarding", basis: "Comparable reviewed onboarding work." }], ...overrides };
};
const input = (overrides = {}) => ({
  id: "calibration-1", asOf: "2027-02-01T00:00:00Z", minimumReferenceClassSize: 2, percentileRate: .8, maximumEvidenceAgeDays: 90,
  review: { reviewer: "Portfolio council", decision: "adopt", rationale: "The reference class is sufficiently evidenced.", reviewedAt: "2027-02-01T01:00:00Z" },
  ...overrides,
});

test("adopts a sufficiently evidenced calibration", () => {
  const report = calibrateRoadmapEstimates([], [oneCase("one"), oneCase("two")], input());
  assert.equal(report.status, "adopted_calibration");
  assert.equal(report.referenceClasses[0].recommendedDurationFactor, 1);
  assert.equal(report.summary.completedItems, 2);
});

test("uses nearest-rank percentile and never recommends below one", () => {
  const first = oneCase("one");
  const second = oneCase("two");
  second.deliveryReport.items[0].actualFinish = "2027-01-08";
  second.deliveryReport.items[0].actualCapacityDays = 3;
  const report = calibrateRoadmapEstimates([], [first, second], input());
  assert.equal(report.referenceClasses[0].percentileDurationRatio, 2.5);
  assert.equal(report.referenceClasses[0].recommendedCapacityFactor, 1.5);
});

test("blocks adoption for an undersized class", () => {
  const report = calibrateRoadmapEstimates([], [oneCase("one")], input());
  assert.equal(report.status, "blocked_adoption");
  assert.equal(report.referenceClasses[0].recommendedDurationFactor, null);
});

test("blocks stale evidence", () => {
  const report = calibrateRoadmapEstimates([], [oneCase("one"), oneCase("two")], input({ maximumEvidenceAgeDays: 10 }));
  assert.equal(report.status, "blocked_adoption");
  assert.equal(report.summary.staleItems, 2);
});

test("keeps revise and defer as human actions", () => {
  for (const decision of ["revise", "defer"])
    assert.equal(calibrateRoadmapEstimates([], [oneCase("one"), oneCase("two")], input({ review: { ...input().review, decision } })).status, "action_required");
});

test("requires matching approved Project 40–41 lineage", () => {
  const bad = oneCase("one"); bad.deliveryReport.sourceScheduleId = "other";
  assert.throws(() => calibrateRoadmapEstimates([], [bad], input()), /matching Project 41/);
  const blocked = oneCase("two"); blocked.scheduleReport.status = "blocked_approval";
  assert.throws(() => calibrateRoadmapEstimates([], [blocked], input()), /approved bounded Project 40/);
});

test("accepts completed items only", () => {
  const bad = oneCase("one"); bad.deliveryReport.items[0].status = "in_progress";
  assert.throws(() => calibrateRoadmapEstimates([], [bad], input()), /completed delivery items only/);
});

test("requires exact unique classifications", () => {
  const bad = oneCase("one"); bad.classifications = [];
  assert.throws(() => calibrateRoadmapEstimates([], [bad], input()), /exactly one reference-class/);
  const duplicate = oneCase("two"); duplicate.classifications.push(duplicate.classifications[0]);
  assert.throws(() => calibrateRoadmapEstimates([], [duplicate], input()), /exactly one reference-class/);
});

test("rejects duplicate delivery case identities", () => {
  assert.throws(() => calibrateRoadmapEstimates([], [oneCase("one"), oneCase("one")], input()), /case IDs must be unique/);
  const first = oneCase("one");
  const second = oneCase("two");
  second.scheduleReport.id = first.scheduleReport.id;
  second.deliveryReport.sourceScheduleId = first.scheduleReport.id;
  assert.throws(() => calibrateRoadmapEstimates([], [first, second], input()), /Schedule case IDs must be unique/);
});

test("validates evidence chronology and policy bounds", () => {
  assert.throws(() => calibrateRoadmapEstimates([], [oneCase("one")], input({ asOf: "2027-01-01T00:00:00Z" })), /cannot follow calibration/);
  assert.throws(() => calibrateRoadmapEstimates([], [oneCase("one")], input({ percentileRate: .2 })), /percentileRate/);
});

test("requires the review after calibration", () => {
  assert.throws(() => calibrateRoadmapEstimates([], [oneCase("one")], input({ review: { ...input().review, reviewedAt: "2027-01-31T00:00:00Z" } })), /cannot precede/);
});
