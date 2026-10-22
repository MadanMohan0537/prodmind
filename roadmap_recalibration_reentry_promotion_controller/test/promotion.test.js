import assert from "node:assert/strict";
import test from "node:test";
import { controlRoadmapRecalibrationReentryPromotion } from "../src/promotion.js";

const learning = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "learning-1", status: "ready_for_reentry",
  contributingConditions: [{ id: "condition-1" }],
  actions: [{ id: "prevent-1" }, { id: "detect-1" }],
  reentry: { baselineVersion: "policy-3", candidateVersion: "policy-5", scope: ["onboarding"], requiredActionIds: ["prevent-1", "detect-1"] },
  approvals: [{ reviewer: "Product reviewer" }, { reviewer: "Delivery reviewer" }, { reviewer: "Governance reviewer" }],
  review: { reviewer: "Re-entry council", decision: "approve_reentry" }, ...overrides,
});

const assurance = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "assurance-1", asOf: "2027-04-01T00:00:00Z", status: "verified_reentry", sourceLearningId: "learning-1",
  declaration: { baselineVersion: "policy-3", candidateVersion: "policy-5", scope: ["onboarding"] },
  rollback: { targetVersion: "policy-3", owner: "Delivery operations", maximumRecoveryHours: 4 },
  review: { reviewer: "Independent assurance lead", decision: "continue", reviewedAt: "2027-04-01T00:00:00Z" }, ...overrides,
});

function checkpoint(id, observedAt, overrides = {}) {
  return { id, observedAt, version: "policy-5", scope: ["onboarding"],
    outcomes: [{ referenceClass: "onboarding", sampleSize: 25, baselineDurationErrorRate: .2, candidateDurationErrorRate: .1, baselineCapacityErrorRate: .2, candidateCapacityErrorRate: .1, incidents: 0, evidence: "Reviewed paired outcomes." }],
    recurrenceControls: [{ conditionId: "condition-1", healthy: true, evidence: "No recurrence detected." }],
    correctiveControls: [{ actionId: "prevent-1", healthy: true, evidence: "Gate passed." }, { actionId: "detect-1", healthy: true, evidence: "Alert exercised." }],
    evidence: `Reviewed ${id} stabilization evidence.`, ...overrides };
}

const input = (overrides = {}) => ({
  id: "promotion-1", asOf: "2027-04-04T00:00:00Z", minimumStabilizationHours: 72, maximumCheckpointGapHours: 48, minimumCheckpoints: 3,
  minimumSamplesPerClass: 60, maximumCandidateErrorRate: .15, minimumImprovementRate: .05, maximumIncidents: 0, maximumRollbackTestAgeDays: 14,
  checkpoints: [checkpoint("day-1", "2027-04-02T00:00:00Z"), checkpoint("day-2", "2027-04-03T00:00:00Z"), checkpoint("day-3", "2027-04-04T00:00:00Z")],
  rollback: { targetVersion: "policy-3", owner: "Delivery operations", testedAt: "2027-03-30T00:00:00Z", maximumRecoveryHours: 4, evidence: "Recovery drill passed." },
  approvals: [
    { role: "product", reviewer: "Product approver", decision: "approve", approvedAt: "2027-04-04T00:00:00Z", evidence: "Product review complete." },
    { role: "delivery", reviewer: "Delivery approver", decision: "approve", approvedAt: "2027-04-04T00:00:00Z", evidence: "Delivery review complete." },
    { role: "assurance", reviewer: "Assurance approver", decision: "approve", approvedAt: "2027-04-04T00:00:00Z", evidence: "Assurance review complete." },
  ],
  review: { reviewer: "Promotion chair", decision: "promote", rationale: "Sustained evidence supports human promotion.", reviewedAt: "2027-04-04T01:00:00Z" }, ...overrides,
});

const run = (l = learning(), a = assurance(), i = input()) => controlRoadmapRecalibrationReentryPromotion(l, a, i);

test("marks sustained verified re-entry ready for promotion", () => { const result = run(); assert.equal(result.status, "ready_for_promotion"); assert.equal(result.summary.samples, 75); assert.ok(result.checks.every((item) => item.passed)); });
test("blocks unverified Project 52 evidence", () => assert.equal(run(learning(), assurance({ status: "blocked_continue" })).status, "blocked_promotion"));
test("blocks mismatched Project 51 lineage", () => assert.equal(run(learning(), assurance({ sourceLearningId: "other" })).status, "blocked_promotion"));
test("blocks a changed candidate version", () => { const value = input(); value.checkpoints[1].version = "policy-6"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks a changed scope", () => { const value = input(); value.checkpoints[1].scope = ["enterprise"]; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("requires the full stabilization window", () => { const value = input({ minimumStabilizationHours: 73 }); assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks excessive checkpoint gaps", () => { const value = input({ maximumCheckpointGapHours: 23 }); assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks insufficient samples", () => { const value = input({ minimumSamplesPerClass: 76 }); assert.equal(run(learning(), assurance(), value).referenceClasses[0].sufficient, false); });
test("blocks candidate error above policy", () => { const value = input(); value.checkpoints[2].outcomes[0].candidateDurationErrorRate = .5; assert.equal(run(learning(), assurance(), value).referenceClasses[0].accurate, false); });
test("blocks missing sustained improvement", () => { const value = input(); for (const row of value.checkpoints) row.outcomes[0].candidateCapacityErrorRate = .2; assert.equal(run(learning(), assurance(), value).referenceClasses[0].improved, false); });
test("blocks recurring incident conditions", () => { const value = input(); value.checkpoints[1].recurrenceControls[0].healthy = false; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks failed corrective controls", () => { const value = input(); value.checkpoints[1].correctiveControls[0].healthy = false; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks incident guardrail breaches", () => { const value = input(); value.checkpoints[1].outcomes[0].incidents = 1; assert.equal(run(learning(), assurance(), value).summary.incidents, 1); });
test("blocks stale rollback tests", () => { const value = input(); value.rollback.testedAt = "2027-03-01T00:00:00Z"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("blocks wrong rollback targets", () => { const value = input(); value.rollback.targetVersion = "policy-2"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("requires affirmative approvals", () => { const value = input(); value.approvals[0].decision = "reject"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("requires independent approval reviewers", () => { const value = input(); value.approvals[0].reviewer = "Re-entry council"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("requires an independent final reviewer", () => { const value = input(); value.review.reviewer = "Product approver"; assert.equal(run(learning(), assurance(), value).status, "blocked_promotion"); });
test("preserves extend and rollback as human actions", () => { for (const decision of ["extend_monitoring", "rollback"]) { const value = input(); value.review.decision = decision; assert.equal(run(learning(), assurance(), value).status, "action_required"); } });
test("rejects malformed inputs", () => { assert.throws(() => run({}, assurance(), input()), /Project 51/); assert.throws(() => run(learning(), assurance(), input({ minimumCheckpoints: 1 })), /2 to 20/); });
