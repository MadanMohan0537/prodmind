const DAY = 86_400_000;

function text(value, name, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new Error(`${name} must contain 1–${maximum} characters`);
  return value.trim();
}

function timestamp(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value)))
    throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

function integer(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

function rate(value, name, minimum = 0, maximum = 1) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new Error(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

const check = (id, passed, detail) => ({ id, passed, detail });
const daysBetween = (start, end) => Math.floor((Date.parse(end) - Date.parse(start)) / DAY);

function normalizeRecovery(report) {
  if (report?.schemaVersion !== "1.0.0" || !report.id || !report.sourceRecalibrationId ||
      !report.sourceRolloutId || !Array.isArray(report.referenceClasses))
    throw new Error("Provide a bounded Project 50 recalibration recovery report");
  if (!report.referenceClasses.length || report.referenceClasses.length > 50)
    throw new Error("Project 50 must include 1–50 reference classes");
  const referenceClasses = report.referenceClasses.map((item, index) =>
    text(item.referenceClass, `Project 50 reference class ${index + 1}`, 120));
  if (new Set(referenceClasses).size !== referenceClasses.length)
    throw new Error("Project 50 reference classes must be unique");
  return {
    id: text(report.id, "Project 50 id", 120),
    asOf: timestamp(report.asOf, "Project 50 asOf"),
    status: text(report.status, "Project 50 status", 30),
    sourceRecalibrationId: text(report.sourceRecalibrationId, "Project 50 sourceRecalibrationId", 120),
    sourceRolloutId: text(report.sourceRolloutId, "Project 50 sourceRolloutId", 120),
    recoveredVersion: text(report.recoveredVersion, "Project 50 recoveredVersion", 80),
    failedVersion: text(report.execution?.fromVersion, "Project 50 failed version", 80),
    referenceClasses,
    reviewer: text(report.review?.reviewer, "Project 50 reviewer", 120),
    decision: text(report.review?.decision, "Project 50 decision", 30),
    reviewedAt: timestamp(report.review?.reviewedAt, "Project 50 reviewedAt"),
  };
}

function normalizeTimeline(raw, publishedAt) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 30)
    throw new Error("timeline must contain 2–30 events");
  const ids = new Set();
  let previous = "";
  return raw.map((item, index) => {
    const id = text(item.id, `timeline event ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("timeline event IDs must be unique");
    ids.add(id);
    const occurredAt = timestamp(item.occurredAt, `${id} occurredAt`);
    if (previous && occurredAt <= previous) throw new Error("timeline events must be strictly chronological");
    if (occurredAt > publishedAt) throw new Error("timeline events cannot follow publication");
    previous = occurredAt;
    return { id, occurredAt, event: text(item.event, `${id} event`, 1000), evidence: text(item.evidence, `${id} evidence`, 1000) };
  });
}

function normalizeConditions(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12)
    throw new Error("Provide 1–12 contributing system conditions");
  const ids = new Set();
  return raw.map((item, index) => {
    const id = text(item.id, `condition ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("condition IDs must be unique");
    ids.add(id);
    const category = text(item.category, `${id} category`, 30);
    if (!["process", "tooling", "data", "coordination", "policy", "monitoring"].includes(category))
      throw new Error(`${id} category is invalid`);
    return { id, category, condition: text(item.condition, `${id} condition`, 1000), evidence: text(item.evidence, `${id} evidence`, 1000) };
  });
}

function normalizeLessons(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) throw new Error("Provide 1–20 lessons");
  const ids = new Set();
  return raw.map((item, index) => {
    const id = text(item.id, `lesson ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("lesson IDs must be unique");
    ids.add(id);
    return { id, statement: text(item.statement, `${id} statement`, 1000), evidence: text(item.evidence, `${id} evidence`, 1000) };
  });
}

function normalizeActions(raw, asOf) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) throw new Error("Provide 1–30 corrective actions");
  const ids = new Set();
  return raw.map((item, index) => {
    const id = text(item.id, `action ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("action IDs must be unique");
    ids.add(id);
    const type = text(item.type, `${id} type`, 20);
    if (!["prevent", "detect", "mitigate"].includes(type)) throw new Error(`${id} type is invalid`);
    const priority = text(item.priority, `${id} priority`, 4);
    if (!["p0", "p1", "p2", "p3"].includes(priority)) throw new Error(`${id} priority is invalid`);
    const status = text(item.status, `${id} status`, 20);
    if (!["open", "completed", "waived"].includes(status)) throw new Error(`${id} status is invalid`);
    const dueAt = timestamp(item.dueAt, `${id} dueAt`);
    const evidence = status === "open" ? "" : text(item.evidence, `${id} evidence`, 1000);
    return {
      id, type, priority, status, dueAt, evidence,
      owner: text(item.owner, `${id} owner`, 120),
      trackingId: text(item.trackingId, `${id} trackingId`, 120),
      successMeasure: text(item.successMeasure, `${id} successMeasure`, 500),
      overdue: status === "open" && dueAt < asOf,
    };
  });
}

function normalizeApprovals(raw, excludedReviewers, reviewedAt) {
  if (!Array.isArray(raw) || raw.length !== 3)
    throw new Error("Product, Delivery, and Assurance approvals are required");
  const requiredRoles = new Set(["product", "delivery", "assurance"]);
  const roles = new Set();
  const reviewers = new Set();
  return raw.map((item, index) => {
    const role = text(item.role, `approval ${index + 1} role`, 30).toLowerCase();
    if (!requiredRoles.has(role) || roles.has(role)) throw new Error("approval roles must be unique and required");
    roles.add(role);
    const reviewer = text(item.reviewer, `${role} reviewer`, 120);
    if (reviewers.has(reviewer) || excludedReviewers.has(reviewer)) throw new Error("approvals must be independent");
    reviewers.add(reviewer);
    const decision = text(item.decision, `${role} decision`, 20);
    if (!["approved", "rejected"].includes(decision)) throw new Error(`${role} approval decision is invalid`);
    const approvedAt = timestamp(item.approvedAt, `${role} approvedAt`);
    if (approvedAt > reviewedAt) throw new Error("approvals cannot follow review");
    return { role, reviewer, decision, approvedAt };
  });
}

export function controlRoadmapRecalibrationReentry(recoveryReport, input = {}) {
  const recovery = normalizeRecovery(recoveryReport);
  const id = text(input.id, "incident review id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < recovery.reviewedAt) throw new Error("asOf cannot precede Project 50 review");
  const maximumPublicationDays = integer(input.maximumPublicationDays, "maximumPublicationDays", 1, 30);
  const minimumCoolingDays = integer(input.minimumCoolingDays, "minimumCoolingDays", 1, 90);
  const maximumInitialExposureRate = rate(input.maximumInitialExposureRate, "maximumInitialExposureRate", 0.01, 0.5);
  const publishedAt = timestamp(input.publishedAt, "publishedAt");
  if (publishedAt < recovery.reviewedAt || publishedAt > asOf)
    throw new Error("publication must follow Project 50 review and not exceed asOf");
  const reviewer = text(input.review?.reviewer, "review reviewer", 120);
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < publishedAt || reviewedAt > asOf) throw new Error("review must follow publication and not exceed asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!["approve_reentry", "continue_freeze", "escalate"].includes(decision))
    throw new Error("review decision is invalid");

  const timeline = normalizeTimeline(input.timeline, publishedAt);
  const conditions = normalizeConditions(input.contributingConditions);
  const lessons = normalizeLessons(input.lessons);
  const actions = normalizeActions(input.actions, asOf);
  const critical = actions.filter((item) => ["p0", "p1"].includes(item.priority));
  const freezeUntil = timestamp(input.freezeUntil, "freezeUntil");
  const reentry = input.reentry ?? {};
  const startsAt = timestamp(reentry.startsAt, "reentry startsAt");
  if (startsAt < asOf) throw new Error("reentry cannot start before asOf");
  const scope = Array.isArray(reentry.scope) ? reentry.scope.map((value, index) => text(value, `reentry scope ${index + 1}`, 120)) : [];
  if (!scope.length || new Set(scope).size !== scope.length || scope.some((value) => !recovery.referenceClasses.includes(value)))
    throw new Error("reentry scope must be a unique non-empty subset of recovered reference classes");
  const requiredActionIds = Array.isArray(reentry.requiredActionIds)
    ? reentry.requiredActionIds.map((value, index) => text(value, `requiredActionIds ${index + 1}`, 80)) : [];
  if (!requiredActionIds.length || new Set(requiredActionIds).size !== requiredActionIds.length ||
      requiredActionIds.some((value) => !actions.some((item) => item.id === value)))
    throw new Error("reentry requiredActionIds must uniquely reference corrective actions");
  const rollback = reentry.rollback ?? {};
  const approvals = normalizeApprovals(input.approvals, new Set([recovery.reviewer, reviewer]), reviewedAt);
  const publicationDays = daysBetween(recovery.reviewedAt, publishedAt);
  const coolingDays = daysBetween(recovery.reviewedAt, startsAt);
  const candidateVersion = text(reentry.candidateVersion, "reentry candidateVersion", 80);
  const baselineVersion = text(reentry.baselineVersion, "reentry baselineVersion", 80);
  const initialExposureRate = rate(reentry.initialExposureRate, "reentry initialExposureRate");
  const rollbackMaximumRecoveryHours = rate(rollback.maximumRecoveryHours, "rollback maximumRecoveryHours", 0.01, 168);

  const checks = [
    check("verified-recovery", recovery.status === "verified_recovery" && recovery.decision === "close", "Project 50 must verify and close recovery."),
    check("timely-publication", publicationDays <= maximumPublicationDays, `Published in ${publicationDays} day(s); allowed ${maximumPublicationDays}.`),
    check("complete-timeline", timeline.every((item) => item.evidence), "The incident timeline is chronological and evidenced."),
    check("system-learning", conditions.every((item) => item.evidence) && lessons.every((item) => item.evidence), "System conditions and lessons retain evidence."),
    check("balanced-actions", actions.some((item) => item.type === "prevent") && actions.some((item) => item.type === "detect"), "Preventive and detective actions are required."),
    check("critical-actions-complete", critical.length > 0 && critical.every((item) => item.status === "completed" && item.evidence), "Every P0/P1 action is completed with evidence."),
    check("no-overdue-actions", actions.every((item) => !item.overdue), "No corrective action is overdue."),
    check("reentry-actions-complete", requiredActionIds.every((actionId) => actions.find((item) => item.id === actionId)?.status === "completed"), "Every action required for re-entry is complete."),
    check("cooling-period", coolingDays >= minimumCoolingDays && startsAt >= freezeUntil, `Re-entry waits ${coolingDays} day(s) and respects the freeze.`),
    check("recovered-baseline", baselineVersion === recovery.recoveredVersion, `Re-entry starts from ${recovery.recoveredVersion}.`),
    check("new-candidate", candidateVersion !== recovery.failedVersion && candidateVersion !== recovery.recoveredVersion, "Re-entry uses a new version, not the failed or recovered version."),
    check("bounded-exposure", reentry.shadowRequired === true && initialExposureRate <= maximumInitialExposureRate, "A shadow stage precedes bounded initial exposure."),
    check("rollback-ready", rollback.targetVersion === recovery.recoveredVersion && Boolean(rollback.owner) && Boolean(rollback.evidence) && rollbackMaximumRecoveryHours > 0, "Re-entry has an evidenced rollback to the recovered baseline."),
    check("monitoring-ready", Array.isArray(reentry.monitors) && ["duration_error", "capacity_error", "incidents"].every((name) => reentry.monitors.includes(name)), "Duration error, capacity error, and incidents are monitored."),
    check("independent-approval", approvals.every((item) => item.decision === "approved"), "Product, Delivery, and Assurance independently approve."),
  ];
  const allChecksPassed = checks.every((item) => item.passed);

  return {
    schemaVersion: "1.0.0", id, asOf,
    status: decision === "approve_reentry" ? (allChecksPassed ? "ready_for_reentry" : "blocked_reentry") : "action_required",
    sourceRecoveryId: recovery.id,
    sourceRecalibrationId: recovery.sourceRecalibrationId,
    sourceRolloutId: recovery.sourceRolloutId,
    recoveredVersion: recovery.recoveredVersion,
    failedVersion: recovery.failedVersion,
    publishedAt, publicationDays, freezeUntil, coolingDays,
    summary: text(input.summary, "summary", 1000),
    impact: text(input.impact, "impact", 1000),
    timeline, contributingConditions: conditions, lessons, actions,
    reentry: {
      owner: text(reentry.owner, "reentry owner", 120),
      hypothesis: text(reentry.hypothesis, "reentry hypothesis", 1000),
      baselineVersion, candidateVersion, scope, startsAt,
      shadowRequired: reentry.shadowRequired, initialExposureRate, requiredActionIds,
      rollback: {
        targetVersion: rollback.targetVersion,
        owner: text(rollback.owner, "rollback owner", 120),
        maximumRecoveryHours: rollbackMaximumRecoveryHours,
        evidence: text(rollback.evidence, "rollback evidence", 1000),
      },
      monitors: reentry.monitors,
    },
    approvals, checks,
    review: { reviewer, decision, rationale: text(input.review?.rationale, "review rationale", 1000), reviewedAt },
    method: "deterministic verified-recovery lineage, timely blameless learning, chronological evidence, corrective-action, cooling, baseline, new-version, scope, shadow, exposure, rollback, monitoring, and independent-approval controls; this controller never lifts a freeze, starts rollout, changes factors or estimates, assigns blame, or proves causality",
  };
}
