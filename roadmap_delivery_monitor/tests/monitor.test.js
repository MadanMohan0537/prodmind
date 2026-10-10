import assert from "node:assert/strict";
import test from "node:test";
import { monitorRoadmapDelivery } from "../src/monitor.js";

const scheduleItem = (id, overrides = {}) => ({
  portfolioItemId: `run:${id}`,
  runId: "run",
  opportunityId: id,
  title: `Outcome ${id}`,
  owner: "Product lead",
  teamId: id === "c" ? "research" : "engineering",
  capacity: 1,
  durationDays: 2,
  start: "2027-01-04",
  finish: "2027-01-05",
  deadline: "2027-01-08",
  workDates: ["2027-01-04", "2027-01-05"],
  dependencies: [],
  evidenceIds: [`evidence-${id}`],
  ...overrides,
});

const schedule = (status = "approved_schedule") => ({
  schemaVersion: "1.0.0",
  id: "roadmap-1",
  asOf: "2027-01-03T00:00:00Z",
  status,
  schedule: [
    scheduleItem("a", { deadline: "2027-01-06" }),
    scheduleItem("b", {
      start: "2027-01-06",
      finish: "2027-01-07",
      workDates: ["2027-01-06", "2027-01-07"],
      dependencies: ["run:a"],
    }),
    scheduleItem("c"),
  ],
});

const progress = (id, overrides = {}) => ({
  portfolioItemId: `run:${id}`,
  status: "completed",
  completedWorkUnits: 2,
  actualCapacityDays: 2,
  remainingEstimateDays: 0,
  actualStart: id === "b" ? "2027-01-06" : "2027-01-04",
  actualFinish: id === "b" ? "2027-01-07" : "2027-01-05",
  evidence: `Delivery record for ${id}.`,
  blockers: [],
  ...overrides,
});

const firstSnapshot = () => ({
  id: "snapshot-1",
  observedAt: "2027-01-05T18:00:00Z",
  items: [
    progress("a"),
    progress("b", {
      status: "not_started",
      completedWorkUnits: 0,
      actualCapacityDays: 0,
      remainingEstimateDays: 2,
      actualStart: null,
      actualFinish: null,
    }),
    progress("c", {
      status: "in_progress",
      completedWorkUnits: 1,
      actualCapacityDays: 1,
      remainingEstimateDays: 1,
      actualFinish: null,
    }),
  ],
});

const finalSnapshot = (overrides = {}) => ({
  id: "snapshot-2",
  observedAt: "2027-01-07T18:00:00Z",
  items: [
    progress("a"),
    progress("b"),
    progress("c", { actualFinish: "2027-01-06", actualCapacityDays: 2.2 }),
  ],
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "delivery-1",
  asOf: "2027-01-07T20:00:00Z",
  minimumSnapshots: 2,
  maximumSnapshotGapDays: 3,
  minimumSchedulePerformanceIndex: 0.9,
  maximumCapacityOverrunRate: 0.2,
  snapshots: [firstSnapshot(), finalSnapshot()],
  review: {
    reviewer: "Delivery council",
    decision: "continue",
    rationale:
      "Delivery evidence, dependencies, capacity, and deadlines are controlled.",
    reviewedAt: "2027-01-07T19:00:00Z",
  },
  ...overrides,
});

test("controls evidence-linked roadmap delivery", () => {
  const result = monitorRoadmapDelivery([], schedule(), input());
  assert.equal(result.status, "controlled_delivery");
  assert.equal(result.summary.completed, 3);
  assert.equal(result.summary.schedulePerformanceIndex, 1);
  assert.ok(result.checks.every((check) => check.passed));
});

test("calculates baseline variance and capacity efficiency inputs", () => {
  const result = monitorRoadmapDelivery([], schedule(), input());
  assert.equal(result.summary.plannedWorkUnits, 6);
  assert.equal(result.summary.earnedWorkUnits, 6);
  assert.equal(result.summary.actualCapacityDays, 6.2);
  assert.equal(
    result.items.find((item) => item.opportunityId === "c").finishVarianceDays,
    1,
  );
});

test("preserves Project 40 and customer-evidence lineage", () => {
  const result = monitorRoadmapDelivery([], schedule(), input());
  assert.equal(result.sourceScheduleId, "roadmap-1");
  assert.deepEqual(result.items[0].evidenceIds, ["evidence-a"]);
  assert.equal(result.items[0].evidence, "Delivery record for a.");
});

test("blocks continue for an unapproved Project 40 schedule", () => {
  const result = monitorRoadmapDelivery(
    [],
    schedule("blocked_approval"),
    input(),
  );
  assert.equal(result.status, "blocked_continue");
  assert.equal(result.checks[0].passed, false);
});

test("detects schedule performance below the declared threshold", () => {
  const latest = finalSnapshot();
  latest.items[1] = progress("b", {
    status: "in_progress",
    completedWorkUnits: 1,
    actualCapacityDays: 1,
    remainingEstimateDays: 1,
    actualFinish: null,
  });
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({ snapshots: [firstSnapshot(), latest] }),
  );
  assert.equal(result.status, "blocked_continue");
  assert.ok(result.summary.schedulePerformanceIndex < 0.9);
});

test("detects excess consumed capacity", () => {
  const latest = finalSnapshot();
  latest.items[2].actualCapacityDays = 8;
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({ snapshots: [firstSnapshot(), latest] }),
  );
  assert.equal(result.status, "blocked_continue");
  assert.equal(
    result.checks.find((check) => check.id === "capacity-variance").passed,
    false,
  );
});

test("detects actual dependency sequencing violations", () => {
  const latest = finalSnapshot();
  latest.items[1] = progress("b", {
    actualStart: "2027-01-05",
    actualFinish: "2027-01-07",
  });
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({ minimumSnapshots: 1, snapshots: [latest] }),
  );
  assert.equal(result.dependencyViolations.length, 1);
  assert.equal(result.status, "blocked_continue");
});

test("detects overdue incomplete work", () => {
  const latest = finalSnapshot({ observedAt: "2027-01-09T18:00:00Z" });
  latest.items[2] = progress("c", {
    status: "in_progress",
    completedWorkUnits: 1,
    actualCapacityDays: 1,
    remainingEstimateDays: 2,
    actualFinish: null,
  });
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({
      asOf: "2027-01-09T20:00:00Z",
      minimumSnapshots: 1,
      snapshots: [latest],
      review: { ...input().review, reviewedAt: "2027-01-09T19:00:00Z" },
    }),
  );
  assert.equal(result.summary.overdue, 1);
  assert.equal(result.status, "blocked_continue");
});

test("detects overdue owned blockers", () => {
  const latest = finalSnapshot();
  latest.items[2] = progress("c", {
    status: "blocked",
    completedWorkUnits: 1,
    actualCapacityDays: 1,
    remainingEstimateDays: 2,
    actualFinish: null,
    blockers: [
      {
        id: "blocker-1",
        type: "technical",
        owner: "Platform lead",
        dueAt: "2027-01-06",
        detail: "Dependency API is unavailable.",
        evidence: "Incident record 12.",
      },
    ],
  });
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({ snapshots: [firstSnapshot(), latest] }),
  );
  assert.equal(result.summary.overdueBlockers, 1);
  assert.equal(result.status, "blocked_continue");
});

test("keeps replan and escalate as named human actions", () => {
  for (const decision of ["replan", "escalate"]) {
    const result = monitorRoadmapDelivery(
      [],
      schedule(),
      input({ review: { ...input().review, decision } }),
    );
    assert.equal(result.status, "action_required");
  }
});

test("detects missing snapshot coverage, cadence gaps, and stale observations", () => {
  const stale = firstSnapshot();
  const result = monitorRoadmapDelivery(
    [],
    schedule(),
    input({
      asOf: "2027-01-10T20:00:00Z",
      minimumSnapshots: 2,
      maximumSnapshotGapDays: 2,
      snapshots: [stale],
      review: { ...input().review, reviewedAt: "2027-01-10T19:00:00Z" },
    }),
  );
  assert.equal(
    result.checks.find((check) => check.id === "snapshot-coverage").passed,
    false,
  );
  assert.equal(
    result.checks.find((check) => check.id === "snapshot-cadence").passed,
    false,
  );
});

test("rejects decreasing earned work or consumed capacity", () => {
  const latest = finalSnapshot();
  latest.items[0].completedWorkUnits = 1;
  latest.items[0].status = "in_progress";
  latest.items[0].remainingEstimateDays = 1;
  latest.items[0].actualFinish = null;
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ snapshots: [firstSnapshot(), latest] }),
      ),
    /cannot decrease|cannot leave completed/,
  );
});

test("rejects completed status regression", () => {
  const latest = finalSnapshot();
  latest.items[0] = progress("a", {
    status: "blocked",
    completedWorkUnits: 1,
    remainingEstimateDays: 1,
    actualFinish: null,
    blockers: [
      {
        id: "b",
        type: "scope",
        owner: "PM",
        dueAt: "2027-01-08",
        detail: "Review scope.",
        evidence: "Review ticket.",
      },
    ],
  });
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ snapshots: [firstSnapshot(), latest] }),
      ),
    /cannot decrease|cannot leave completed/,
  );
});

test("requires exact snapshot coverage", () => {
  const missing = finalSnapshot();
  missing.items.pop();
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ minimumSnapshots: 1, snapshots: [missing] }),
      ),
    /cover every scheduled item/,
  );
  const unknown = finalSnapshot();
  unknown.items[2].portfolioItemId = "run:unknown";
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ minimumSnapshots: 1, snapshots: [unknown] }),
      ),
    /unknown scheduled work/,
  );
});

test("rejects inconsistent progress states", () => {
  const invalid = finalSnapshot();
  invalid.items[2] = progress("c", {
    status: "completed",
    completedWorkUnits: 1,
  });
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ minimumSnapshots: 1, snapshots: [invalid] }),
      ),
    /completed values are inconsistent/,
  );
});

test("rejects malformed schedules and invalid policy bounds", () => {
  assert.throws(() => monitorRoadmapDelivery([], {}, input()), /Project 40/);
  assert.throws(
    () =>
      monitorRoadmapDelivery([], schedule(), input({ minimumSnapshots: 0 })),
    /minimumSnapshots/,
  );
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({ maximumCapacityOverrunRate: 2 }),
      ),
    /maximumCapacityOverrunRate/,
  );
});

test("requires review after the latest observation", () => {
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({
          review: { ...input().review, reviewedAt: "2027-01-06T00:00:00Z" },
        }),
      ),
    /latest observation/,
  );
});

test("rejects delivery evidence before the approved baseline", () => {
  const early = firstSnapshot();
  early.observedAt = "2027-01-02T18:00:00Z";
  early.items = early.items.map((item) => ({
    portfolioItemId: item.portfolioItemId,
    status: "not_started",
    completedWorkUnits: 0,
    actualCapacityDays: 0,
    remainingEstimateDays: 2,
    actualStart: null,
    actualFinish: null,
    evidence: item.evidence,
    blockers: [],
  }));
  assert.throws(
    () =>
      monitorRoadmapDelivery(
        [],
        schedule(),
        input({
          asOf: "2027-01-03T20:00:00Z",
          minimumSnapshots: 1,
          snapshots: [early],
          review: {
            ...input().review,
            reviewedAt: "2027-01-03T19:00:00Z",
          },
        }),
      ),
    /cannot precede the Project 40 baseline/,
  );
});
