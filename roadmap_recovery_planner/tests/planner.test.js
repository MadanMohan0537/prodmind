import test from "node:test";
import assert from "node:assert/strict";
import { planRoadmapRecovery } from "../src/planner.js";

const schedule = () => ({
  schemaVersion: "1.0.0",
  id: "schedule-1",
  asOf: "2027-01-03T18:00:00.000Z",
  status: "approved_schedule",
  schedule: [
    { portfolioItemId: "run:a", evidenceIds: ["feedback-a"] },
    { portfolioItemId: "run:b", evidenceIds: ["feedback-b"] },
  ],
});

const delivery = () => ({
  schemaVersion: "1.0.0",
  id: "delivery-1",
  asOf: "2027-01-12T18:00:00.000Z",
  sourceScheduleId: "schedule-1",
  status: "blocked_continue",
  checks: [
    { id: "schedule-performance", passed: false },
    { id: "capacity-variance", passed: false },
    { id: "deadline-control", passed: true },
  ],
  items: [
    { portfolioItemId: "run:a" },
    { portfolioItemId: "run:b" },
  ],
});

const candidate = (overrides = {}) => ({
  id: "capacity-action",
  type: "capacity_adjustment",
  title: "Reduce delivery handoff load",
  owner: "Delivery lead",
  targetCheckIds: ["schedule-performance", "capacity-variance"],
  portfolioItemIds: ["run:a", "run:b"],
  effortDays: 3,
  dueAt: "2027-01-20",
  dependencies: [],
  changesBaseline: false,
  reversible: true,
  rationale: "The reviewed handoff queue is consuming planned delivery capacity.",
  exitCriteria: "Both failed controls pass in the next delivery snapshot.",
  evidence: "Reviewed delivery and capacity logs dated 2027-01-12.",
  ...overrides,
});

const input = (overrides = {}) => ({
  id: "recovery-1",
  asOf: "2027-01-13T12:00:00Z",
  horizonEnd: "2027-02-28",
  capacityDays: 5,
  minimumCoverageRate: 1,
  candidates: [candidate()],
  review: {
    reviewer: "Roadmap council",
    decision: "approve",
    rationale: "The bounded reversible action covers both failed controls.",
    reviewedAt: "2027-01-13T13:00:00Z",
  },
  ...overrides,
});

test("approves a bounded evidence-linked recovery plan", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input());
  assert.equal(report.status, "approved_recovery_plan");
  assert.equal(report.summary.coverageRate, 1);
  assert.deepEqual(report.selectedActions[0].sourceEvidenceIds, ["feedback-a", "feedback-b"]);
});

test("selects unique coverage before lower effort", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input({
    capacityDays: 5,
    candidates: [
      candidate({ id: "schedule-only", targetCheckIds: ["schedule-performance"], effortDays: 1 }),
      candidate({ id: "both", effortDays: 4 }),
    ],
  }));
  assert.deepEqual(report.selectedActions.map((entry) => entry.id), ["both"]);
});

test("uses dependencies and includes prerequisites", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input({
    candidates: [
      candidate({ id: "schedule", type: "schedule_repair", targetCheckIds: ["schedule-performance"], effortDays: 1 }),
      candidate({ id: "capacity", dependencies: ["schedule"], effortDays: 3 }),
    ],
  }));
  assert.deepEqual(report.selectedActions.map((entry) => entry.id), ["schedule", "capacity"]);
});

test("blocks approval below declared coverage", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input({
    capacityDays: 1,
    candidates: [candidate({ targetCheckIds: ["schedule-performance"], effortDays: 1 })],
  }));
  assert.equal(report.status, "blocked_approval");
  assert.deepEqual(report.uncoveredCheckIds, ["capacity-variance"]);
});

test("keeps revise and defer as named human actions", () => {
  for (const decision of ["revise", "defer"])
    assert.equal(planRoadmapRecovery([], schedule(), delivery(), input({ review: { ...input().review, decision } })).status, "action_required");
});

test("prefers no baseline change when coverage is equal", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input({
    candidates: [
      candidate({ id: "deadline", type: "deadline_decision", targetCheckIds: ["schedule-performance"], changesBaseline: true, effortDays: 1 }),
      candidate({ id: "capacity", effortDays: 3 }),
    ],
  }));
  assert.deepEqual(report.selectedActions.map((entry) => entry.id), ["capacity"]);
});

test("prefers reversible action when coverage and baseline impact match", () => {
  const report = planRoadmapRecovery([], schedule(), delivery(), input({
    candidates: [candidate({ id: "permanent", reversible: false }), candidate({ id: "reversible", reversible: true })],
  }));
  assert.deepEqual(report.selectedActions.map((entry) => entry.id), ["reversible"]);
});

test("requires a matching Project 40 and 41 lineage", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), { ...delivery(), sourceScheduleId: "other" }, input()), /matching Project 41/);
});

test("requires a failed Project 41 control", () => {
  const source = delivery();
  source.checks = source.checks.map((check) => ({ ...check, passed: true }));
  assert.throws(() => planRoadmapRecovery([], schedule(), source, input()), /no failed control/);
});

test("rejects invented or incompatible targets", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ targetCheckIds: ["deadline-control"] })] })), /only unique failed/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ type: "blocker_resolution" })] })), /incompatible/);
});

test("rejects unknown work and preserves exact source coverage", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ portfolioItemIds: ["missing"] })] })), /unknown or duplicate/);
  const source = delivery();
  source.items.pop();
  assert.throws(() => planRoadmapRecovery([], schedule(), source, input()), /exactly cover/);
});

test("rejects cycles and missing dependencies", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ dependencies: ["missing"] })] })), /unknown dependency/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ id: "a", dependencies: ["b"] }), candidate({ id: "b", dependencies: ["a"] })] })), /cycle/);
});

test("requires prerequisite actions to be due first", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({
    candidates: [
      candidate({ id: "first", dueAt: "2027-01-25" }),
      candidate({ id: "second", dueAt: "2027-01-20", dependencies: ["first"] }),
    ],
  })), /due before its dependency/);
});

test("enforces baseline-change declarations", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ type: "deadline_decision", targetCheckIds: ["schedule-performance"] })] })), /baseline-change/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ changesBaseline: true })] })), /baseline-change/);
});

test("bounds dates and review chronology", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ asOf: "2027-01-01T00:00:00Z" })), /cannot precede/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ horizonEnd: "2028-01-01" })), /within 180 days/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ review: { ...input().review, reviewedAt: "2027-01-12T00:00:00Z" } })), /review must occur/);
});

test("bounds candidates and exact search", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [] })), /1–16/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: Array.from({ length: 17 }, (_, index) => candidate({ id: `a-${index}` })) })), /1–16/);
});

test("rejects duplicate candidate, target, and item identities", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate(), candidate()] })), /IDs must be unique/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ targetCheckIds: ["schedule-performance", "schedule-performance"] })] })), /only unique failed/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ candidates: [candidate({ portfolioItemIds: ["run:a", "run:a"] })] })), /unknown or duplicate/);
});

test("rejects malformed thresholds and decisions", () => {
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ minimumCoverageRate: 2 })), /minimumCoverageRate/);
  assert.throws(() => planRoadmapRecovery([], schedule(), delivery(), input({ review: { ...input().review, decision: "execute" } })), /decision is invalid/);
});
