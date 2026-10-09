import assert from "node:assert/strict";
import test from "node:test";
import { scheduleRoadmap } from "../src/scheduler.js";

const item = (id, dependencies = [], overrides = {}) => ({
  portfolioItemId: `run:${id}`,
  runId: "run",
  opportunityId: id,
  title: `Outcome ${id}`,
  score: 8,
  effort: 2,
  dependencies,
  evidenceIds: [`evidence-${id}`],
  ...overrides,
});

const portfolio = (selected, status = "aligned") => ({
  schemaVersion: "1.1.0",
  status,
  selected,
});

const plan = (id, teamId, overrides = {}) => ({
  portfolioItemId: `run:${id}`,
  teamId,
  durationDays: 2,
  capacity: 1,
  earliestStart: "2027-01-04",
  deadline: "2027-01-08",
  owner: `${teamId} owner`,
  outcome: `Deliver measurable outcome ${id}.`,
  estimateBasis: "Reviewed two-day estimate based on a comparable delivery.",
  ...overrides,
});

const selected = [item("a"), item("b", ["run:a"]), item("c")];
const baseInput = (overrides = {}) => ({
  id: "roadmap-1",
  asOf: "2027-01-03T12:00:00Z",
  horizonStart: "2027-01-04",
  maximumHorizonDays: 30,
  workingWeekdays: [1, 2, 3, 4, 5],
  nonWorkingDates: [],
  teams: [
    { id: "engineering", name: "Engineering", capacity: 1 },
    { id: "research", name: "Research", capacity: 1 },
  ],
  plans: [
    plan("a", "engineering", { deadline: "2027-01-05" }),
    plan("b", "engineering", { deadline: "2027-01-07" }),
    plan("c", "research", { deadline: "2027-01-05" }),
  ],
  review: {
    reviewer: "Portfolio council",
    decision: "approve",
    rationale: "Dependencies, capacity, dates, and outcomes are reviewable.",
    reviewedAt: "2027-01-03T12:00:00Z",
  },
  ...overrides,
});

test("approves a capacity-feasible evidence-linked roadmap", () => {
  const result = scheduleRoadmap([], portfolio(selected), baseInput());
  assert.equal(result.status, "approved_schedule");
  assert.equal(result.summary.items, 3);
  assert.equal(result.summary.finish, "2027-01-07");
  assert.ok(result.schedule.every((entry) => entry.evidenceIds.length));
  assert.ok(result.checks.every((entry) => entry.passed));
});

test("honors dependencies before successors", () => {
  const result = scheduleRoadmap([], portfolio(selected), baseInput());
  const a = result.schedule.find((entry) => entry.opportunityId === "a");
  const b = result.schedule.find((entry) => entry.opportunityId === "b");
  assert.ok(a.finish < b.start);
});

test("uses independent teams in parallel", () => {
  const result = scheduleRoadmap([], portfolio(selected), baseInput());
  const a = result.schedule.find((entry) => entry.opportunityId === "a");
  const c = result.schedule.find((entry) => entry.opportunityId === "c");
  assert.equal(a.start, c.start);
  assert.equal(a.finish, c.finish);
});

test("optimizes urgent work before flexible independent work", () => {
  const items = [item("a"), item("b")];
  const input = baseInput({
    teams: [{ id: "engineering", name: "Engineering", capacity: 1 }],
    plans: [
      plan("a", "engineering", { deadline: "2027-01-15" }),
      plan("b", "engineering", { deadline: "2027-01-05" }),
    ],
  });
  const result = scheduleRoadmap([], portfolio(items), input);
  assert.equal(result.schedule[0].opportunityId, "b");
  assert.equal(result.summary.missedDeadlines, 0);
  assert.equal(result.summary.combinationsEvaluated, 2);
});

test("skips weekends and global non-working dates", () => {
  const result = scheduleRoadmap(
    [],
    portfolio([item("a")]),
    baseInput({
      plans: [
        plan("a", "engineering", { durationDays: 3, deadline: "2027-01-08" }),
      ],
      nonWorkingDates: ["2027-01-05"],
    }),
  );
  assert.deepEqual(result.schedule[0].workDates, [
    "2027-01-04",
    "2027-01-06",
    "2027-01-07",
  ]);
});

test("respects team-specific non-working dates", () => {
  const result = scheduleRoadmap(
    [],
    portfolio([item("a")]),
    baseInput({
      teams: [
        {
          id: "engineering",
          name: "Engineering",
          capacity: 1,
          nonWorkingDates: ["2027-01-04"],
        },
      ],
      plans: [plan("a", "engineering")],
    }),
  );
  assert.equal(result.schedule[0].start, "2027-01-05");
});

test("reports a dependency-only critical path and limitation", () => {
  const result = scheduleRoadmap([], portfolio(selected), baseInput());
  assert.deepEqual(result.dependencyCriticalPath.criticalPortfolioItemIds, [
    "run:a",
    "run:b",
  ]);
  assert.match(result.dependencyCriticalPath.limitation, /resource contention/);
});

test("blocks approval when Project 14 is not aligned", () => {
  const result = scheduleRoadmap(
    [],
    portfolio(selected, "closest_feasible"),
    baseInput(),
  );
  assert.equal(result.status, "blocked_approval");
  assert.equal(result.checks[0].passed, false);
});

test("blocks approval when deadlines cannot be met", () => {
  const plans = baseInput().plans.map((entry) => ({
    ...entry,
    deadline: "2027-01-05",
  }));
  const result = scheduleRoadmap([], portfolio(selected), baseInput({ plans }));
  assert.equal(result.status, "blocked_approval");
  assert.ok(result.summary.missedDeadlines > 0);
});

test("keeps revise and defer as named human actions", () => {
  for (const decision of ["revise", "defer"]) {
    const input = baseInput({ review: { ...baseInput().review, decision } });
    assert.equal(
      scheduleRoadmap([], portfolio(selected), input).status,
      "action_required",
    );
  }
});

test("rejects dependency cycles", () => {
  const cyclic = [item("a", ["run:b"]), item("b", ["run:a"])];
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio(cyclic),
        baseInput({
          plans: [plan("a", "engineering"), plan("b", "engineering")],
        }),
      ),
    /acyclic/,
  );
});

test("rejects unscheduled dependencies", () => {
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a", ["run:missing"])]),
        baseInput({ plans: [plan("a", "engineering")] }),
      ),
    /unscheduled dependency/,
  );
});

test("requires exactly one plan per selected item", () => {
  assert.throws(
    () => scheduleRoadmap([], portfolio(selected), baseInput({ plans: [] })),
    /exactly one/,
  );
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a")]),
        baseInput({ plans: [plan("missing", "engineering")] }),
      ),
    /Unknown selected/,
  );
});

test("rejects unknown teams and excess capacity", () => {
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a")]),
        baseInput({ plans: [plan("a", "missing")] }),
      ),
    /unknown team/,
  );
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a")]),
        baseInput({ plans: [plan("a", "engineering", { capacity: 2 })] }),
      ),
    /exceeds/,
  );
});

test("rejects invalid calendar and horizon dates", () => {
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a")]),
        baseInput({
          horizonStart: "2027-01-02",
          plans: [plan("a", "engineering")],
        }),
      ),
    /precede asOf/,
  );
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a")]),
        baseInput({
          workingWeekdays: [1, 1],
          plans: [plan("a", "engineering")],
        }),
      ),
    /unique/,
  );
});

test("rejects malformed reports, missing evidence, and oversized exact search", () => {
  assert.throws(() => scheduleRoadmap([], {}, baseInput()), /Project 14/);
  assert.throws(
    () =>
      scheduleRoadmap(
        [],
        portfolio([item("a", [], { evidenceIds: [] })]),
        baseInput({ plans: [plan("a", "engineering")] }),
      ),
    /retain 1–200 evidence IDs/,
  );
  const tooMany = Array.from({ length: 9 }, (_, index) => item(`x${index}`));
  assert.throws(
    () => scheduleRoadmap([], portfolio(tooMany), baseInput()),
    /At most 8/,
  );
});
