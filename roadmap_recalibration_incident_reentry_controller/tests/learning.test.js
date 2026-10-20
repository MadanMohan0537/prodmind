import assert from "node:assert/strict";
import test from "node:test";
import { controlRoadmapRecalibrationReentry } from "../src/learning.js";

const recovery = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "recovery-1", asOf: "2027-03-13T12:00:00Z",
  status: "verified_recovery", sourceRecalibrationId: "recalibration-1", sourceRolloutId: "rollout-1",
  recoveredVersion: "estimate-policy-3", execution: { fromVersion: "estimate-policy-4" },
  referenceClasses: [{ referenceClass: "onboarding" }],
  review: { reviewer: "Recovery council", decision: "close", reviewedAt: "2027-03-13T13:00:00Z" },
  ...overrides,
});

const approvals = ["product", "delivery", "assurance"].map((role, index) => ({
  role, reviewer: `Independent reviewer ${index}`, decision: "approved", approvedAt: "2027-03-20T00:00:00Z",
}));

const input = (overrides = {}) => ({
  id: "learning-1", asOf: "2027-03-21T00:00:00Z", maximumPublicationDays: 7,
  minimumCoolingDays: 14, maximumInitialExposureRate: 0.1, publishedAt: "2027-03-18T00:00:00Z",
  summary: "A recalibration candidate degraded estimate quality and was rolled back.",
  impact: "One planning cohort received less accurate estimate factors.",
  timeline: [
    { id: "rollback", occurredAt: "2027-03-10T01:00:00Z", event: "Rollback was authorized.", evidence: "Project 49 decision." },
    { id: "recovered", occurredAt: "2027-03-13T13:00:00Z", event: "Recovery was verified.", evidence: "Project 50 report." },
  ],
  contributingConditions: [{ id: "condition-1", category: "monitoring", condition: "The candidate threshold missed a cohort-specific degradation.", evidence: "Paired cohort trace." }],
  lessons: [{ id: "lesson-1", statement: "Require cohort coverage before active exposure.", evidence: "Post-rollback analysis." }],
  actions: [
    { id: "prevent-1", type: "prevent", priority: "p1", status: "completed", owner: "Estimation platform", trackingId: "ACT-1", successMeasure: "Cohort coverage blocks incomplete candidates.", dueAt: "2027-03-20T00:00:00Z", evidence: "Passing coverage tests." },
    { id: "detect-1", type: "detect", priority: "p2", status: "completed", owner: "Delivery analytics", trackingId: "ACT-2", successMeasure: "Alert detects cohort error regression.", dueAt: "2027-03-20T00:00:00Z", evidence: "Alert exercise record." },
  ],
  freezeUntil: "2027-03-27T13:00:00Z",
  reentry: {
    owner: "Delivery operations", hypothesis: "A new candidate with cohort coverage can improve accuracy safely.",
    baselineVersion: "estimate-policy-3", candidateVersion: "estimate-policy-5", scope: ["onboarding"],
    startsAt: "2027-03-28T13:00:00Z", shadowRequired: true, initialExposureRate: 0.05,
    requiredActionIds: ["prevent-1", "detect-1"],
    rollback: { targetVersion: "estimate-policy-3", owner: "Delivery operations", maximumRecoveryHours: 4, evidence: "Prior version remains packaged and tested." },
    monitors: ["duration_error", "capacity_error", "incidents"],
  },
  approvals: approvals.map((item) => ({ ...item })),
  review: { reviewer: "Re-entry council", decision: "approve_reentry", rationale: "Learning and safety gates are complete.", reviewedAt: "2027-03-21T00:00:00Z" },
  ...overrides,
});

test("approves bounded recalibration re-entry with complete lineage", () => {
  const result = controlRoadmapRecalibrationReentry(recovery(), input());
  assert.equal(result.status, "ready_for_reentry");
  assert.equal(result.sourceRecoveryId, "recovery-1");
  assert.equal(result.reentry.candidateVersion, "estimate-policy-5");
  assert.ok(result.checks.every((item) => item.passed));
});

test("blocks unverified recovery", () => assert.equal(controlRoadmapRecalibrationReentry(recovery({ status: "blocked_close" }), input()).status, "blocked_reentry"));
test("blocks recovery without human close", () => assert.equal(controlRoadmapRecalibrationReentry(recovery({ review: { reviewer: "Recovery council", decision: "continue_monitoring", reviewedAt: "2027-03-13T13:00:00Z" } }), input()).status, "blocked_reentry"));
test("blocks late publication", () => assert.equal(controlRoadmapRecalibrationReentry(recovery(), input({ maximumPublicationDays: 3 })).status, "blocked_reentry"));
test("requires chronological timeline", () => { const value = input(); value.timeline.reverse(); assert.throws(() => controlRoadmapRecalibrationReentry(recovery(), value), /strictly chronological/); });
test("requires preventive and detective actions", () => { const value = input(); value.actions = [value.actions[0]]; value.reentry = { ...value.reentry, requiredActionIds: ["prevent-1"] }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires completed evidenced critical actions", () => { const value = input(); value.actions[0] = { ...value.actions[0], status: "open", evidence: undefined }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("blocks overdue open actions", () => { const value = input(); value.actions[1] = { ...value.actions[1], status: "open", evidence: undefined, dueAt: "2027-03-20T00:00:00Z" }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires re-entry actions to be complete", () => { const value = input(); value.actions[1] = { ...value.actions[1], status: "open", evidence: undefined, dueAt: "2027-04-20T00:00:00Z" }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("enforces cooling period and freeze", () => { const value = input(); value.reentry = { ...value.reentry, startsAt: "2027-03-22T00:00:00Z" }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires recovered baseline", () => { const value = input(); value.reentry = { ...value.reentry, baselineVersion: "estimate-policy-2" }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires a genuinely new candidate version", () => { for (const candidateVersion of ["estimate-policy-3", "estimate-policy-4"]) { const value = input(); value.reentry = { ...value.reentry, candidateVersion }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); } });
test("requires recovered scope subset", () => { const value = input(); value.reentry = { ...value.reentry, scope: ["billing"] }; assert.throws(() => controlRoadmapRecalibrationReentry(recovery(), value), /subset/); });
test("requires shadow and bounded exposure", () => { const value = input(); value.reentry = { ...value.reentry, shadowRequired: false, initialExposureRate: 0.2 }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires rollback to recovered baseline", () => { const value = input(); value.reentry.rollback = { ...value.reentry.rollback, targetVersion: "estimate-policy-2" }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires core monitors", () => { const value = input(); value.reentry = { ...value.reentry, monitors: ["duration_error"] }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("blocks rejected approval", () => { const value = input(); value.approvals = approvals.map((item, index) => index ? item : { ...item, decision: "rejected" }); assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "blocked_reentry"); });
test("requires independent approvers", () => { const value = input(); value.approvals[0] = { ...value.approvals[0], reviewer: "Recovery council" }; assert.throws(() => controlRoadmapRecalibrationReentry(recovery(), value), /independent/); });
test("keeps freeze and escalation human controlled", () => { for (const decision of ["continue_freeze", "escalate"]) { const value = input(); value.review = { ...value.review, decision }; assert.equal(controlRoadmapRecalibrationReentry(recovery(), value).status, "action_required"); } });
test("rejects malformed recovery and invalid policy bounds", () => { assert.throws(() => controlRoadmapRecalibrationReentry({}, input()), /Project 50/); assert.throws(() => controlRoadmapRecalibrationReentry(recovery(), input({ minimumCoolingDays: 0 })), /1 to 90/); });
