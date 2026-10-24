import assert from "node:assert/strict";
import test from "node:test";
import { controlRoadmapRecalibrationBaselineHandoff } from "../src/handoff.js";

const outcome = (overrides = {}) => ({
  schemaVersion: "1.0.0", id: "outcome-1", status: "verified_promotion_outcome", baselineVersion: "policy-3", promotedVersion: "policy-5", scope: ["onboarding"],
  execution: { owner: "Delivery operations" }, rollback: { targetVersion: "policy-3", owner: "Delivery operations", maximumRecoveryHours: 4 },
  review: { reviewer: "Outcome chair", decision: "retain", reviewedAt: "2027-04-08T03:00:00Z" }, ...overrides,
});
const consumers = (version = "policy-5") => ["roadmap_scheduler", "estimate_adoption", "estimate_effectiveness", "estimate_drift", "recalibration_controller"].map((type, index) => ({ id: `consumer-${index}`, type, acceptedVersion: version, acknowledgedAt: "2027-04-08T05:00:00Z", owner: `Owner ${index}`, evidence: `Reviewed ${type} configuration.` }));
const input = (overrides = {}) => ({
  id: "handoff-1", asOf: "2027-04-08T06:00:00Z", maximumHandoffHours: 24, minimumArchiveDays: 365, maximumRollbackTestAgeDays: 14,
  manifest: { sourceOutcomeId: "outcome-1", previousVersion: "policy-3", activeVersion: "policy-5", effectiveAt: "2027-04-08T04:00:00Z", owner: "Estimation platform", factorManifestId: "factors-5", scope: ["onboarding"], evidence: "Signed version registry entry." },
  referenceClasses: [{ referenceClass: "onboarding", factorManifestId: "factors-5", status: "active", owner: "Estimation platform", evidence: "Class points to the approved manifest." }],
  consumers: consumers(),
  archive: { version: "policy-3", archivedAt: "2027-04-08T05:00:00Z", retentionUntil: "2028-04-08T05:00:00Z", immutable: true, owner: "Records owner", evidence: "Immutable archive receipt." },
  rollback: { targetVersion: "policy-3", owner: "Delivery operations", testedAt: "2027-04-07T00:00:00Z", maximumRecoveryHours: 4, evidence: "Recovery drill passed." },
  monitoring: { effectivenessOwner: "Effectiveness council", effectivenessDueAt: "2027-05-08T00:00:00Z", driftOwner: "Drift council", driftDueAt: "2027-06-08T00:00:00Z", evidence: "Calendar and ownership records." },
  approvals: ["product", "delivery", "assurance"].map((role, index) => ({ role, reviewer: `Handoff approver ${index}`, decision: "approve", approvedAt: "2027-04-08T05:30:00Z", evidence: `Reviewed ${role} handoff evidence.` })),
  review: { reviewer: "Baseline chair", decision: "complete_handoff", rationale: "Every governed consumer converged on the verified baseline.", reviewedAt: "2027-04-08T07:00:00Z" }, ...overrides,
});
const run = (o = outcome(), i = input()) => controlRoadmapRecalibrationBaselineHandoff(o, i);

test("completes an exact baseline handoff", () => { const result = run(); assert.equal(result.status, "baseline_handoff_complete"); assert.equal(result.summary.convergedConsumers, 5); assert.ok(result.checks.every((item) => item.passed)); });
test("blocks an unverified Project 54 outcome", () => assert.equal(run(outcome({ status: "blocked_retention" })).status, "blocked_handoff"));
test("requires the Project 54 retain decision", () => assert.equal(run(outcome({ review: { reviewer: "Outcome chair", decision: "extend_monitoring", reviewedAt: "2027-04-08T03:00:00Z" } })).status, "blocked_handoff"));
test("blocks mismatched outcome lineage", () => { const value = input(); value.manifest.sourceOutcomeId = "other"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("blocks mismatched versions", () => { const value = input(); value.manifest.activeVersion = "policy-6"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("blocks changed scope", () => { const value = input(); value.manifest.scope = ["enterprise"]; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires a timely handoff", () => assert.equal(run(outcome(), input({ maximumHandoffHours: 2 })).status, "blocked_handoff"));
test("requires exact reference-class coverage", () => { const value = input(); value.referenceClasses[0].status = "pending"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires one factor manifest", () => { const value = input(); value.referenceClasses[0].factorManifestId = "other"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires all five consumer types", () => { const value = input(); value.consumers.pop(); assert.throws(() => run(outcome(), value), /five required/); });
test("blocks a consumer on the previous version", () => { const value = input(); value.consumers[2].acceptedVersion = "policy-3"; const result = run(outcome(), value); assert.equal(result.summary.convergedConsumers, 4); assert.equal(result.status, "blocked_handoff"); });
test("rejects acknowledgments before the effective time", () => { const value = input(); value.consumers[0].acknowledgedAt = "2027-04-08T03:30:00Z"; assert.throws(() => run(outcome(), value), /acknowledgments/); });
test("requires the superseded baseline archive", () => { const value = input(); value.archive.version = "policy-2"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires an immutable archive", () => { const value = input(); value.archive.immutable = false; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires minimum archive retention", () => { const value = input(); value.archive.retentionUntil = "2027-05-08T05:00:00Z"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("blocks stale or mismatched rollback", () => { const stale = input(); stale.rollback.testedAt = "2027-03-01T00:00:00Z"; assert.equal(run(outcome(), stale).status, "blocked_handoff"); const wrong = input(); wrong.rollback.targetVersion = "policy-2"; assert.equal(run(outcome(), wrong).status, "blocked_handoff"); });
test("requires distinct future monitoring owners", () => { const value = input(); value.monitoring.driftOwner = value.monitoring.effectivenessOwner; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("requires independent affirmative approvals", () => { const value = input(); value.approvals[0].reviewer = "Outcome chair"; value.approvals[1].decision = "reject"; assert.equal(run(outcome(), value).status, "blocked_handoff"); });
test("preserves transition and rollback as human actions", () => { for (const decision of ["continue_transition", "rollback"]) { const value = input(); value.review.decision = decision; assert.equal(run(outcome(), value).status, "action_required"); } });
test("rejects malformed inputs and invalid policy", () => { assert.throws(() => run({}, input()), /Project 54/); assert.throws(() => run(outcome(), input({ minimumArchiveDays: 29 })), /30 to 3650/); });
