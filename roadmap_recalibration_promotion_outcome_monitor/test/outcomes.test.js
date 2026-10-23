import assert from "node:assert/strict";
import test from "node:test";
import { monitorRoadmapRecalibrationPromotionOutcomes } from "../src/outcomes.js";

const promotion = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "promotion-1", status: "ready_for_promotion", baselineVersion: "policy-3", candidateVersion: "policy-5", scope: ["onboarding"],
  checkpoints: [{ recurrenceControls: [{ conditionId: "condition-1" }], correctiveControls: [{ actionId: "prevent-1" }, { actionId: "detect-1" }] }],
  rollback: { targetVersion: "policy-3", owner: "Delivery operations", maximumRecoveryHours: 4 },
  approvals: [{ reviewer: "Product approver" }, { reviewer: "Delivery approver" }, { reviewer: "Assurance approver" }],
  review: { reviewer: "Promotion chair", decision: "promote", reviewedAt: "2027-04-04T01:00:00Z" }, ...overrides,
});

function snapshot(id, observedAt, promotedPopulation, overrides = {}) {
  return { id, observedAt, version: "policy-5", scope: ["onboarding"], populationSize: 100, promotedPopulation,
    outcomes: [{ referenceClass: "onboarding", sampleSize: 25, baselineDurationErrorRate: .2, promotedDurationErrorRate: .1, baselineCapacityErrorRate: .2, promotedCapacityErrorRate: .1, incidents: 0, evidence: "Reviewed paired outcomes." }],
    recurrenceControls: [{ conditionId: "condition-1", healthy: true, evidence: "No recurrence detected." }],
    correctiveControls: [{ actionId: "prevent-1", healthy: true, evidence: "Gate passed." }, { actionId: "detect-1", healthy: true, evidence: "Alert exercised." }],
    evidence: `Reviewed ${id} operating evidence.`, ...overrides };
}

const input = (overrides = {}) => ({
  id: "outcome-1", asOf: "2027-04-08T02:00:00Z", minimumObservationHours: 72, maximumSnapshotGapHours: 24, minimumSnapshots: 3,
  minimumAdoptionRate: 1, minimumSamplesPerClass: 60, maximumPromotedErrorRate: .15, minimumImprovementRate: .05, maximumIncidents: 0, maximumRollbackTestAgeDays: 14,
  execution: { changeId: "change-1", sourcePromotionId: "promotion-1", authorizedAt: "2027-04-04T01:00:00Z", executedAt: "2027-04-05T01:00:00Z", fromVersion: "policy-3", toVersion: "policy-5", owner: "Delivery operations", evidence: "Reviewed change record." },
  snapshots: [snapshot("day-1", "2027-04-06T01:00:00Z", 50), snapshot("day-2", "2027-04-07T01:00:00Z", 80), snapshot("day-3", "2027-04-08T01:00:00Z", 100)],
  rollback: { targetVersion: "policy-3", owner: "Delivery operations", testedAt: "2027-04-04T00:00:00Z", maximumRecoveryHours: 4, evidence: "Recovery drill passed." },
  review: { reviewer: "Outcome chair", decision: "retain", rationale: "Promotion remained stable across the full observation window.", reviewedAt: "2027-04-08T03:00:00Z" }, ...overrides,
});

const run = (p = promotion(), i = input()) => monitorRoadmapRecalibrationPromotionOutcomes(p, i);

test("verifies a stable promoted operating baseline", () => { const result = run(); assert.equal(result.status, "verified_promotion_outcome"); assert.equal(result.summary.samples, 75); assert.ok(result.checks.every((item) => item.passed)); });
test("blocks a Project 53 report not ready for promotion", () => assert.equal(run(promotion({ status: "blocked_promotion" })).status, "blocked_retention"));
test("requires the human Project 53 promote decision", () => assert.equal(run(promotion({ review: { reviewer: "Promotion chair", decision: "extend_monitoring", reviewedAt: "2027-04-04T01:00:00Z" } })).status, "blocked_retention"));
test("blocks mismatched promotion lineage", () => { const value = input(); value.execution.sourcePromotionId = "other"; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("requires exact activation versions", () => { const value = input(); value.execution.toVersion = "policy-6"; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("rejects execution before authorization", () => { const value = input(); value.execution.executedAt = "2027-04-04T00:00:00Z"; assert.throws(() => run(promotion(), value), /timing/); });
test("blocks a mixed snapshot version", () => { const value = input(); value.snapshots[1].version = "policy-3"; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("blocks changed operating scope", () => { const value = input(); value.snapshots[1].scope = ["enterprise"]; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("requires complete final adoption", () => { const value = input(); value.snapshots[2].promotedPopulation = 99; assert.equal(run(promotion(), value).summary.finalAdoptionRate, .99); assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("requires the full observation window", () => assert.equal(run(promotion(), input({ minimumObservationHours: 73 })).status, "blocked_retention"));
test("blocks excessive snapshot gaps", () => assert.equal(run(promotion(), input({ maximumSnapshotGapHours: 23 })).status, "blocked_retention"));
test("blocks insufficient samples", () => assert.equal(run(promotion(), input({ minimumSamplesPerClass: 76 })).referenceClasses[0].sufficient, false));
test("blocks promoted error above policy", () => { const value = input(); value.snapshots[2].outcomes[0].promotedDurationErrorRate = .5; assert.equal(run(promotion(), value).referenceClasses[0].accurate, false); });
test("blocks missing sustained improvement", () => { const value = input(); for (const row of value.snapshots) row.outcomes[0].promotedCapacityErrorRate = .2; assert.equal(run(promotion(), value).referenceClasses[0].improved, false); });
test("blocks unhealthy recurrence and corrective controls", () => { const value = input(); value.snapshots[1].recurrenceControls[0].healthy = false; value.snapshots[1].correctiveControls[0].healthy = false; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("blocks incident guardrail breaches", () => { const value = input(); value.snapshots[1].outcomes[0].incidents = 1; assert.equal(run(promotion(), value).summary.incidents, 1); });
test("blocks stale or mismatched rollback", () => { const stale = input(); stale.rollback.testedAt = "2027-03-01T00:00:00Z"; assert.equal(run(promotion(), stale).status, "blocked_retention"); const wrong = input(); wrong.rollback.targetVersion = "policy-2"; assert.equal(run(promotion(), wrong).status, "blocked_retention"); });
test("requires an independent outcome reviewer", () => { const value = input(); value.review.reviewer = "Product approver"; assert.equal(run(promotion(), value).status, "blocked_retention"); });
test("preserves extension and rollback as human actions", () => { for (const decision of ["extend_monitoring", "rollback"]) { const value = input(); value.review.decision = decision; assert.equal(run(promotion(), value).status, "action_required"); } });
test("rejects malformed inputs and invalid policy", () => { assert.throws(() => run({}, input()), /Project 53/); assert.throws(() => run(promotion(), input({ minimumSnapshots: 1 })), /2 to 30/); });
