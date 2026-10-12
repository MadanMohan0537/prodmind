import test from "node:test";
import assert from "node:assert/strict";
import { verifyRoadmapRecovery } from "../src/verifier.js";

const schedule = () => ({ schemaVersion: "1.0.0", id: "schedule-1", schedule: [{ portfolioItemId: "run:a" }] });
const baseline = () => ({
  schemaVersion: "1.0.0", id: "delivery-before", asOf: "2027-01-12T18:00:00Z", sourceScheduleId: "schedule-1",
  checks: [{ id: "schedule-performance", passed: false }, { id: "capacity-variance", passed: true }],
  items: [{ portfolioItemId: "run:a" }],
});
const plan = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "recovery-1", asOf: "2027-01-13T12:00:00Z", status: "approved_recovery_plan",
  sourceScheduleId: "schedule-1", sourceDeliveryMonitorId: "delivery-before", failedCheckIds: ["schedule-performance"],
  selectedActions: [{
    id: "action-1", title: "Restore delivery sequence", effortDays: 2, dueAt: "2027-01-20", changesBaseline: false,
    portfolioItemIds: ["run:a"], sourceEvidenceIds: ["feedback-a"],
  }],
  ...overrides,
});
const followup = (passed = true) => ({
  schemaVersion: "1.0.0", id: "delivery-after", asOf: "2027-01-27T18:00:00Z", sourceScheduleId: "schedule-1",
  checks: [{ id: "schedule-performance", passed }, { id: "capacity-variance", passed: true }],
  items: [{ portfolioItemId: "run:a" }],
});
const outcome = (overrides = {}) => ({
  actionId: "action-1", status: "completed", completedAt: "2027-01-20T18:00:00Z", actualEffortDays: 2,
  executionEvidence: "Change record 42 confirms implementation.", exitEvidence: "Reviewed delivery control passed after implementation.",
  ...overrides,
});
const input = (overrides = {}) => ({
  id: "verification-1", asOf: "2027-01-28T12:00:00Z", minimumObservationDays: 7, maximumEffortVarianceRate: .25,
  actionOutcomes: [outcome()],
  review: { reviewer: "Roadmap council", decision: "close", rationale: "Execution and follow-up controls are verified.", reviewedAt: "2027-01-28T13:00:00Z" },
  ...overrides,
});

test("verifies executed recovery with restored controls", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input());
  assert.equal(report.status, "verified_recovery");
  assert.deepEqual(report.restoredCheckIds, ["schedule-performance"]);
  assert.deepEqual(report.sourceEvidenceIds, ["feedback-a"]);
});

test("blocks close when an action is incomplete", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ status: "in_progress", completedAt: null })] }));
  assert.equal(report.status, "blocked_close");
  assert.equal(report.checks.find((check) => check.id === "execution-completeness").passed, false);
});

test("blocks close when a failed control remains unresolved", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(false), input());
  assert.equal(report.status, "blocked_close");
  assert.deepEqual(report.unresolvedCheckIds, ["schedule-performance"]);
});

test("detects late action completion", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ completedAt: "2027-01-21T18:00:00Z" })] }));
  assert.equal(report.summary.lateActions, 1);
  assert.equal(report.status, "blocked_close");
});

test("detects effort outside tolerance", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ actualEffortDays: 3 })] }));
  assert.equal(report.summary.effortExceptions, 1);
  assert.equal(report.status, "blocked_close");
});

test("requires a mature follow-up observation", () => {
  const report = verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ minimumObservationDays: 8 }));
  assert.equal(report.status, "blocked_close");
  assert.equal(report.checks.find((check) => check.id === "observation-maturity").passed, false);
});

test("keeps continue and escalate as named human actions", () => {
  for (const decision of ["continue_monitoring", "escalate"])
    assert.equal(verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ review: { ...input().review, decision } })).status, "action_required");
});

test("requires an approved matching recovery plan", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan({ status: "blocked_approval" }), followup(), input()), /approved matching Project 42/);
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan({ sourceDeliveryMonitorId: "other" }), followup(), input()), /approved matching Project 42/);
});

test("requires exact action outcome coverage", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [] })), /exactly one outcome/);
  const two = plan(); two.selectedActions.push({ ...two.selectedActions[0], id: "action-2" });
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), two, followup(), input({ actionOutcomes: [outcome(), outcome()] })), /unknown or duplicate/);
});

test("requires a later follow-up Project 41 report", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), { ...followup(), asOf: "2027-01-13T00:00:00Z" }, input()), /chronology/);
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), { ...followup(), sourceScheduleId: "other" }, input()), /matching follow-up/);
});

test("requires every failed control to be reassessed", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), { ...followup(), checks: [{ id: "capacity-variance", passed: true }] }, input()), /reassess every failed/);
});

test("rejects failures invented by Project 42", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan({ failedCheckIds: ["capacity-variance"] }), followup(), input()), /must originate/);
});

test("requires follow-up item coverage", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), { ...followup(), items: [] }, input()), /cover scheduled work exactly/);
  const duplicate = schedule();
  duplicate.schedule.push({ portfolioItemId: "run:b" });
  assert.throws(() => verifyRoadmapRecovery([], duplicate, { ...baseline(), sourceScheduleId: duplicate.id }, plan(), { ...followup(), items: [{ portfolioItemId: "run:a" }, { portfolioItemId: "run:a" }] }, input()), /cover scheduled work exactly/);
});

test("validates the selected action source contract", () => {
  const invalidEffort = plan(); invalidEffort.selectedActions[0].effortDays = -1;
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), invalidEffort, followup(), input()), /planned effortDays/);
  const invalidDate = plan(); invalidDate.selectedActions[0].dueAt = "tomorrow";
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), invalidDate, followup(), input()), /dueAt/);
  const missingLineage = plan(); missingLineage.selectedActions[0].sourceEvidenceIds = [];
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), missingLineage, followup(), input()), /source evidence lineage/);
});

test("enforces completion state and chronology", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ completedAt: null })] })), /inconsistent/);
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ completedAt: "2027-01-29T00:00:00Z" })] })), /after asOf/);
});

test("requires prior approval for a baseline change", () => {
  const changed = plan(); changed.selectedActions[0].changesBaseline = true;
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), changed, followup(), input()), /requires prior baseline-change approval/);
  const approved = input({ actionOutcomes: [outcome({ baselineChangeApproval: { reviewer: "Portfolio chair", decision: "approved", rationale: "Formal change is bounded and reviewed.", reviewedAt: "2027-01-19T12:00:00Z" } })] });
  assert.equal(verifyRoadmapRecovery([], schedule(), baseline(), changed, followup(), approved).summary.baselineChanges, 1);
});

test("rejects unnecessary baseline approvals", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ actionOutcomes: [outcome({ baselineChangeApproval: { reviewer: "x", decision: "approved", rationale: "x", reviewedAt: "2027-01-19T00:00:00Z" } })] })), /unnecessary/);
});

test("bounds policy values and review decision", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ maximumEffortVarianceRate: 2 })), /maximumEffortVarianceRate/);
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ review: { ...input().review, decision: "auto-close" } })), /decision is invalid/);
});

test("requires review after verification", () => {
  assert.throws(() => verifyRoadmapRecovery([], schedule(), baseline(), plan(), followup(), input({ review: { ...input().review, reviewedAt: "2027-01-28T11:00:00Z" } })), /cannot precede verification/);
});
