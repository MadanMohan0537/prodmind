const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const REQUIRED_CONSUMERS = ["roadmap_scheduler", "estimate_adoption", "estimate_effectiveness", "estimate_drift", "recalibration_controller"];

function text(value, name, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${name} must contain 1–${maximum} characters`);
  return value.trim();
}
function timestamp(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}
function number(value, name, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} must be a number from ${minimum} to ${maximum}`);
  return value;
}
function integer(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}
const round = (value) => Number(value.toFixed(4));
const hoursBetween = (start, end) => round((Date.parse(end) - Date.parse(start)) / HOUR);
const check = (id, passed, detail) => ({ id, passed, detail });
function uniqueStrings(raw, name, maximum = 50) {
  if (!Array.isArray(raw) || !raw.length || raw.length > maximum) throw new Error(`${name} must contain 1–${maximum} values`);
  const values = raw.map((value, index) => text(value, `${name} ${index + 1}`, 120));
  if (new Set(values).size !== values.length) throw new Error(`${name} values must be unique`);
  return values;
}

function normalizeOutcome(report) {
  if (report?.schemaVersion !== "1.0.0" || !report.id || !report.execution || !report.review || !report.rollback) throw new Error("Provide a bounded Project 54 promotion outcome report");
  return {
    id: text(report.id, "Project 54 id", 120),
    status: text(report.status, "Project 54 status", 40),
    decision: text(report.review.decision, "Project 54 decision", 30),
    reviewer: text(report.review.reviewer, "Project 54 reviewer", 120),
    reviewedAt: timestamp(report.review.reviewedAt, "Project 54 reviewedAt"),
    executionOwner: text(report.execution.owner, "Project 54 execution owner", 120),
    previousVersion: text(report.baselineVersion, "Project 54 baselineVersion", 80),
    activeVersion: text(report.promotedVersion, "Project 54 promotedVersion", 80),
    scope: uniqueStrings(report.scope, "Project 54 scope", 50),
    rollback: {
      targetVersion: text(report.rollback.targetVersion, "Project 54 rollback targetVersion", 80),
      owner: text(report.rollback.owner, "Project 54 rollback owner", 120),
      maximumRecoveryHours: number(report.rollback.maximumRecoveryHours, "Project 54 maximumRecoveryHours", 0.01, 168),
    },
  };
}

function normalizeReferenceClasses(raw, outcome, manifestId) {
  if (!Array.isArray(raw) || raw.length !== outcome.scope.length) throw new Error("Reference-class handoff must cover the complete Project 54 scope");
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `reference class ${index + 1}`, 120);
    if (seen.has(referenceClass) || !outcome.scope.includes(referenceClass)) throw new Error("Reference classes must be unique and in Project 54 scope");
    seen.add(referenceClass);
    return {
      referenceClass,
      factorManifestId: text(item.factorManifestId, `${referenceClass} factorManifestId`, 120),
      status: text(item.status, `${referenceClass} status`, 20),
      owner: text(item.owner, `${referenceClass} owner`, 120),
      evidence: text(item.evidence, `${referenceClass} evidence`, 1000),
      matchesManifest: item.factorManifestId === manifestId,
    };
  });
}

function normalizeConsumers(raw, activeVersion, effectiveAt, asOf) {
  if (!Array.isArray(raw) || raw.length !== REQUIRED_CONSUMERS.length) throw new Error("Provide all five required baseline consumers");
  const seen = new Set();
  return raw.map((item, index) => {
    const type = text(item.type, `consumer ${index + 1} type`, 40);
    if (seen.has(type) || !REQUIRED_CONSUMERS.includes(type)) throw new Error("Consumer types must be unique and required");
    seen.add(type);
    const acknowledgedAt = timestamp(item.acknowledgedAt, `${type} acknowledgedAt`);
    if (acknowledgedAt < effectiveAt || acknowledgedAt > asOf) throw new Error("Consumer acknowledgments must follow the effective time and not exceed asOf");
    return {
      id: text(item.id, `${type} id`, 120), type,
      acceptedVersion: text(item.acceptedVersion, `${type} acceptedVersion`, 80),
      acknowledgedAt, owner: text(item.owner, `${type} owner`, 120),
      evidence: text(item.evidence, `${type} evidence`, 1000),
      converged: item.acceptedVersion === activeVersion,
    };
  });
}

function normalizeApprovals(raw, asOf) {
  const roles = ["product", "delivery", "assurance"];
  if (!Array.isArray(raw) || raw.length !== roles.length) throw new Error("Provide product, delivery, and assurance handoff approvals");
  const seen = new Set();
  return raw.map((item, index) => {
    const role = text(item.role, `approval ${index + 1} role`, 30);
    if (seen.has(role) || !roles.includes(role)) throw new Error("Approval roles must be unique and required"); seen.add(role);
    const approvedAt = timestamp(item.approvedAt, `${role} approvedAt`); if (approvedAt > asOf) throw new Error("Approvals cannot follow asOf");
    return { role, reviewer: text(item.reviewer, `${role} reviewer`, 120), decision: text(item.decision, `${role} decision`, 20), approvedAt, evidence: text(item.evidence, `${role} evidence`, 1000) };
  });
}

export function controlRoadmapRecalibrationBaselineHandoff(outcomeReport, input = {}) {
  const outcome = normalizeOutcome(outcomeReport);
  const id = text(input.id, "handoff id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < outcome.reviewedAt) throw new Error("asOf cannot precede Project 54 review");
  const policy = {
    maximumHandoffHours: integer(input.maximumHandoffHours, "maximumHandoffHours", 1, 720),
    minimumArchiveDays: integer(input.minimumArchiveDays, "minimumArchiveDays", 30, 3650),
    maximumRollbackTestAgeDays: integer(input.maximumRollbackTestAgeDays, "maximumRollbackTestAgeDays", 1, 90),
  };
  const manifest = {
    sourceOutcomeId: text(input.manifest?.sourceOutcomeId, "manifest sourceOutcomeId", 120),
    previousVersion: text(input.manifest?.previousVersion, "manifest previousVersion", 80),
    activeVersion: text(input.manifest?.activeVersion, "manifest activeVersion", 80),
    effectiveAt: timestamp(input.manifest?.effectiveAt, "manifest effectiveAt"),
    owner: text(input.manifest?.owner, "manifest owner", 120),
    factorManifestId: text(input.manifest?.factorManifestId, "manifest factorManifestId", 120),
    scope: uniqueStrings(input.manifest?.scope, "manifest scope", 50),
    evidence: text(input.manifest?.evidence, "manifest evidence", 1000),
  };
  if (manifest.effectiveAt < outcome.reviewedAt || manifest.effectiveAt > asOf) throw new Error("Manifest effective time must follow Project 54 review and not exceed asOf");
  const referenceClasses = normalizeReferenceClasses(input.referenceClasses, outcome, manifest.factorManifestId);
  const consumers = normalizeConsumers(input.consumers, outcome.activeVersion, manifest.effectiveAt, asOf);
  const archive = {
    version: text(input.archive?.version, "archive version", 80),
    archivedAt: timestamp(input.archive?.archivedAt, "archive archivedAt"),
    retentionUntil: timestamp(input.archive?.retentionUntil, "archive retentionUntil"),
    immutable: input.archive?.immutable === true,
    owner: text(input.archive?.owner, "archive owner", 120),
    evidence: text(input.archive?.evidence, "archive evidence", 1000),
  };
  if (archive.archivedAt < manifest.effectiveAt || archive.archivedAt > asOf || archive.retentionUntil <= archive.archivedAt) throw new Error("Archive timing is invalid");
  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    testedAt: timestamp(input.rollback?.testedAt, "rollback testedAt"),
    maximumRecoveryHours: number(input.rollback?.maximumRecoveryHours, "rollback maximumRecoveryHours", 0.01, 168),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.testedAt > asOf) throw new Error("Rollback test cannot follow asOf");
  const monitoring = {
    effectivenessOwner: text(input.monitoring?.effectivenessOwner, "monitoring effectivenessOwner", 120),
    effectivenessDueAt: timestamp(input.monitoring?.effectivenessDueAt, "monitoring effectivenessDueAt"),
    driftOwner: text(input.monitoring?.driftOwner, "monitoring driftOwner", 120),
    driftDueAt: timestamp(input.monitoring?.driftDueAt, "monitoring driftDueAt"),
    evidence: text(input.monitoring?.evidence, "monitoring evidence", 1000),
  };
  const approvals = normalizeApprovals(input.approvals, asOf);
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt"); if (reviewedAt < asOf) throw new Error("Review cannot precede handoff asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!["complete_handoff", "continue_transition", "rollback"].includes(decision)) throw new Error("Review decision is invalid");
  const reviewer = text(input.review?.reviewer, "review reviewer", 120);
  const exactScope = manifest.scope.length === outcome.scope.length && manifest.scope.every((value) => outcome.scope.includes(value));
  const rollbackAgeDays = round((Date.parse(asOf) - Date.parse(rollback.testedAt)) / DAY);
  const archiveDays = round((Date.parse(archive.retentionUntil) - Date.parse(archive.archivedAt)) / DAY);
  const handoffHours = hoursBetween(outcome.reviewedAt, asOf);
  const approvalReviewers = approvals.map((item) => item.reviewer);
  const checks = [
    check("verified-outcome", outcome.status === "verified_promotion_outcome" && outcome.decision === "retain", "Project 54 must verify the promoted baseline and record a human retain decision."),
    check("exact-manifest", manifest.sourceOutcomeId === outcome.id && manifest.previousVersion === outcome.previousVersion && manifest.activeVersion === outcome.activeVersion && exactScope, "The handoff manifest preserves Project 54 lineage, versions, and scope."),
    check("timely-handoff", handoffHours <= policy.maximumHandoffHours, `Handoff completed in ${handoffHours} hour(s) against ${policy.maximumHandoffHours}.`),
    check("complete-class-registration", referenceClasses.every((item) => item.status === "active" && item.matchesManifest), "Every reference class is active under one factor manifest."),
    check("consumer-convergence", consumers.every((item) => item.converged), "All required roadmap-estimation consumers acknowledge the same active version."),
    check("superseded-archive", archive.version === outcome.previousVersion && archive.immutable && archiveDays >= policy.minimumArchiveDays, "The superseded baseline is immutable and retained for the required period."),
    check("rollback-current", rollback.targetVersion === outcome.rollback.targetVersion && rollback.owner === outcome.rollback.owner && rollback.maximumRecoveryHours <= outcome.rollback.maximumRecoveryHours && rollbackAgeDays <= policy.maximumRollbackTestAgeDays, "Rollback remains exact, owned, time-bounded, and recently tested."),
    check("monitoring-handoff", monitoring.effectivenessDueAt > asOf && monitoring.driftDueAt > asOf && monitoring.effectivenessOwner !== monitoring.driftOwner, "Named owners and future reviews hand the baseline to effectiveness and drift monitoring."),
    check("independent-approvals", approvals.every((item) => item.decision === "approve") && new Set(approvalReviewers).size === approvals.length && approvalReviewers.every((name) => name !== outcome.reviewer && name !== outcome.executionOwner), "Product, Delivery, and Assurance approvals are affirmative and independent."),
    check("independent-review", reviewer !== outcome.reviewer && reviewer !== outcome.executionOwner && !approvalReviewers.includes(reviewer), "The final handoff reviewer is independent from outcome review, execution, and approvals."),
  ];
  const allChecksPassed = checks.every((item) => item.passed);
  return {
    schemaVersion: "1.0.0", id, asOf,
    status: decision === "complete_handoff" ? (allChecksPassed ? "baseline_handoff_complete" : "blocked_handoff") : "action_required",
    sourceOutcomeId: outcome.id, previousVersion: outcome.previousVersion, activeVersion: outcome.activeVersion, scope: outcome.scope,
    policy, manifest, referenceClasses, consumers, archive: { ...archive, retentionDays: archiveDays }, rollback: { ...rollback, ageDays: rollbackAgeDays }, monitoring, approvals,
    summary: { referenceClasses: referenceClasses.length, consumers: consumers.length, convergedConsumers: consumers.filter((item) => item.converged).length, handoffHours, allChecksPassed },
    checks,
    review: { reviewer, decision, rationale: text(input.review?.rationale, "review rationale", 1000), reviewedAt },
    method: "deterministic Project 54 lineage, baseline-manifest, handoff-timing, reference-class registration, required-consumer convergence, immutable-archive, rollback-freshness, downstream-monitoring, independent-approval, and named human-decision checks; this controller never changes configuration, factors, estimates, schedules, consumers, archives, monitoring, rollback, or product state",
  };
}
