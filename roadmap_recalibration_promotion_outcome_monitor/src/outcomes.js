const HOUR = 3_600_000;
const DAY = 24 * HOUR;

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

function normalizePromotion(report) {
  if (report?.schemaVersion !== "1.0.0" || !report.id || !report.review || !report.rollback || !Array.isArray(report.checkpoints)) {
    throw new Error("Provide a bounded Project 53 promotion report");
  }
  const conditions = [...new Set(report.checkpoints.flatMap((item) => item.recurrenceControls?.map((row) => row.conditionId) ?? []))];
  const actions = [...new Set(report.checkpoints.flatMap((item) => item.correctiveControls?.map((row) => row.actionId) ?? []))];
  return {
    id: text(report.id, "Project 53 id", 120),
    status: text(report.status, "Project 53 status", 40),
    candidateVersion: text(report.candidateVersion, "Project 53 candidateVersion", 80),
    baselineVersion: text(report.baselineVersion, "Project 53 baselineVersion", 80),
    scope: uniqueStrings(report.scope, "Project 53 scope", 50),
    conditions: uniqueStrings(conditions, "Project 53 condition IDs", 50),
    actions: uniqueStrings(actions, "Project 53 action IDs", 50),
    reviewer: text(report.review.reviewer, "Project 53 reviewer", 120),
    decision: text(report.review.decision, "Project 53 decision", 30),
    reviewedAt: timestamp(report.review.reviewedAt, "Project 53 reviewedAt"),
    approvers: (report.approvals ?? []).map((item) => text(item.reviewer, "Project 53 approver", 120)),
    rollback: {
      targetVersion: text(report.rollback.targetVersion, "Project 53 rollback targetVersion", 80),
      owner: text(report.rollback.owner, "Project 53 rollback owner", 120),
      maximumRecoveryHours: number(report.rollback.maximumRecoveryHours, "Project 53 maximumRecoveryHours", 0.01, 168),
    },
  };
}

function normalizeOutcomes(raw, id, scope) {
  if (!Array.isArray(raw) || raw.length !== scope.length) throw new Error(`${id} must report every promoted reference class exactly once`);
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `${id} outcome ${index + 1} referenceClass`, 120);
    if (seen.has(referenceClass) || !scope.includes(referenceClass)) throw new Error(`${id} reference classes must be unique and promoted`);
    seen.add(referenceClass);
    return {
      referenceClass,
      sampleSize: integer(item.sampleSize, `${id} ${referenceClass} sampleSize`, 1, 1_000_000),
      baselineDurationErrorRate: number(item.baselineDurationErrorRate, `${id} baselineDurationErrorRate`, 0, 10),
      promotedDurationErrorRate: number(item.promotedDurationErrorRate, `${id} promotedDurationErrorRate`, 0, 10),
      baselineCapacityErrorRate: number(item.baselineCapacityErrorRate, `${id} baselineCapacityErrorRate`, 0, 10),
      promotedCapacityErrorRate: number(item.promotedCapacityErrorRate, `${id} promotedCapacityErrorRate`, 0, 10),
      incidents: integer(item.incidents, `${id} incidents`, 0, 1_000_000),
      evidence: text(item.evidence, `${id} evidence`, 1000),
    };
  });
}

function exactControls(raw, expected, key, id, label) {
  if (!Array.isArray(raw) || raw.length !== expected.length) throw new Error(`${id} must report every ${label}`);
  const seen = new Set();
  return raw.map((item, index) => {
    const value = text(item[key], `${id} ${label} ${index + 1}`, 120);
    if (seen.has(value) || !expected.includes(value)) throw new Error(`${id} ${label} must be unique and promoted`);
    seen.add(value);
    return { [key]: value, healthy: item.healthy === true, evidence: text(item.evidence, `${id} ${value} evidence`, 1000) };
  });
}

function normalizeSnapshots(raw, promotion, execution, asOf, policy) {
  if (!Array.isArray(raw) || raw.length < policy.minimumSnapshots || raw.length > 30) throw new Error(`Provide ${policy.minimumSnapshots}–30 outcome snapshots`);
  const ids = new Set(); let previous = execution.executedAt;
  return raw.map((item, index) => {
    const id = text(item.id, `snapshot ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Snapshot IDs must be unique"); ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`);
    if (observedAt <= previous || observedAt > asOf) throw new Error("Snapshots must be chronological after activation");
    const gapHours = hoursBetween(previous, observedAt); previous = observedAt;
    const populationSize = integer(item.populationSize, `${id} populationSize`, 1, 10_000_000);
    const promotedPopulation = integer(item.promotedPopulation, `${id} promotedPopulation`, 0, populationSize);
    const version = text(item.version, `${id} version`, 80);
    const scope = uniqueStrings(item.scope, `${id} scope`, 50);
    return {
      id, observedAt, gapHours, version, scope, populationSize, promotedPopulation,
      adoptionRate: round(promotedPopulation / populationSize),
      outcomes: normalizeOutcomes(item.outcomes, id, promotion.scope),
      recurrenceControls: exactControls(item.recurrenceControls, promotion.conditions, "conditionId", id, "recurrence conditions"),
      correctiveControls: exactControls(item.correctiveControls, promotion.actions, "actionId", id, "corrective controls"),
      evidence: text(item.evidence, `${id} evidence`, 1000),
      withinGap: gapHours <= policy.maximumSnapshotGapHours,
      exactVersion: version === promotion.candidateVersion,
      exactScope: scope.length === promotion.scope.length && scope.every((value) => promotion.scope.includes(value)),
    };
  });
}

function summarizeClasses(snapshots, scope, policy) {
  return scope.map((referenceClass) => {
    const rows = snapshots.map((snapshot) => snapshot.outcomes.find((item) => item.referenceClass === referenceClass));
    const sampleSize = rows.reduce((sum, row) => sum + row.sampleSize, 0);
    const weighted = (field) => round(rows.reduce((sum, row) => sum + row[field] * row.sampleSize, 0) / sampleSize);
    const baselineDurationErrorRate = weighted("baselineDurationErrorRate");
    const promotedDurationErrorRate = weighted("promotedDurationErrorRate");
    const baselineCapacityErrorRate = weighted("baselineCapacityErrorRate");
    const promotedCapacityErrorRate = weighted("promotedCapacityErrorRate");
    return {
      referenceClass, sampleSize, baselineDurationErrorRate, promotedDurationErrorRate,
      durationImprovementRate: round(baselineDurationErrorRate - promotedDurationErrorRate),
      baselineCapacityErrorRate, promotedCapacityErrorRate,
      capacityImprovementRate: round(baselineCapacityErrorRate - promotedCapacityErrorRate),
      incidents: rows.reduce((sum, row) => sum + row.incidents, 0),
      sufficient: sampleSize >= policy.minimumSamplesPerClass,
      accurate: promotedDurationErrorRate <= policy.maximumPromotedErrorRate && promotedCapacityErrorRate <= policy.maximumPromotedErrorRate,
      improved: baselineDurationErrorRate - promotedDurationErrorRate >= policy.minimumImprovementRate && baselineCapacityErrorRate - promotedCapacityErrorRate >= policy.minimumImprovementRate,
    };
  });
}

export function monitorRoadmapRecalibrationPromotionOutcomes(promotionReport, input = {}) {
  const promotion = normalizePromotion(promotionReport);
  const id = text(input.id, "outcome id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const policy = {
    minimumObservationHours: integer(input.minimumObservationHours, "minimumObservationHours", 24, 4320),
    maximumSnapshotGapHours: integer(input.maximumSnapshotGapHours, "maximumSnapshotGapHours", 1, 720),
    minimumSnapshots: integer(input.minimumSnapshots, "minimumSnapshots", 2, 30),
    minimumAdoptionRate: number(input.minimumAdoptionRate, "minimumAdoptionRate", 0.5, 1),
    minimumSamplesPerClass: integer(input.minimumSamplesPerClass, "minimumSamplesPerClass", 2, 1_000_000),
    maximumPromotedErrorRate: number(input.maximumPromotedErrorRate, "maximumPromotedErrorRate", 0, 2),
    minimumImprovementRate: number(input.minimumImprovementRate, "minimumImprovementRate", 0, 1),
    maximumIncidents: integer(input.maximumIncidents, "maximumIncidents", 0, 10_000),
    maximumRollbackTestAgeDays: integer(input.maximumRollbackTestAgeDays, "maximumRollbackTestAgeDays", 1, 90),
  };
  const execution = {
    changeId: text(input.execution?.changeId, "execution changeId", 120),
    sourcePromotionId: text(input.execution?.sourcePromotionId, "execution sourcePromotionId", 120),
    authorizedAt: timestamp(input.execution?.authorizedAt, "execution authorizedAt"),
    executedAt: timestamp(input.execution?.executedAt, "execution executedAt"),
    fromVersion: text(input.execution?.fromVersion, "execution fromVersion", 80),
    toVersion: text(input.execution?.toVersion, "execution toVersion", 80),
    owner: text(input.execution?.owner, "execution owner", 120),
    evidence: text(input.execution?.evidence, "execution evidence", 1000),
  };
  if (execution.executedAt < execution.authorizedAt || execution.executedAt > asOf) throw new Error("Promotion execution timing is invalid");
  const snapshots = normalizeSnapshots(input.snapshots, promotion, execution, asOf, policy);
  const classes = summarizeClasses(snapshots, promotion.scope, policy);
  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    testedAt: timestamp(input.rollback?.testedAt, "rollback testedAt"),
    maximumRecoveryHours: number(input.rollback?.maximumRecoveryHours, "rollback maximumRecoveryHours", 0.01, 168),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.testedAt > asOf) throw new Error("Rollback test cannot follow asOf");
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("Review cannot precede outcome asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!["retain", "extend_monitoring", "rollback"].includes(decision)) throw new Error("Review decision is invalid");
  const reviewer = text(input.review?.reviewer, "review reviewer", 120);
  const controls = snapshots.flatMap((item) => [...item.recurrenceControls, ...item.correctiveControls]);
  const totalIncidents = classes.reduce((sum, item) => sum + item.incidents, 0);
  const observationHours = hoursBetween(execution.executedAt, snapshots.at(-1).observedAt);
  const rollbackAgeDays = round((Date.parse(asOf) - Date.parse(rollback.testedAt)) / DAY);
  const excludedReviewers = new Set([promotion.reviewer, ...promotion.approvers]);
  const checks = [
    check("approved-promotion", promotion.status === "ready_for_promotion" && promotion.decision === "promote", "Project 53 must record promotion readiness and a human promote decision."),
    check("authorized-execution", execution.sourcePromotionId === promotion.id && execution.authorizedAt >= promotion.reviewedAt && execution.fromVersion === promotion.baselineVersion && execution.toVersion === promotion.candidateVersion, "Execution follows the exact Project 53 authorization, versions, and timing."),
    check("exact-version-and-scope", snapshots.every((item) => item.exactVersion && item.exactScope), "Every outcome snapshot preserves the promoted version and scope."),
    check("complete-adoption", snapshots.at(-1).adoptionRate >= policy.minimumAdoptionRate, `Final adoption is ${snapshots.at(-1).adoptionRate} against ${policy.minimumAdoptionRate}.`),
    check("observation-window", observationHours >= policy.minimumObservationHours, `Outcome monitoring covers ${observationHours} hour(s).`),
    check("snapshot-continuity", snapshots.every((item) => item.withinGap), `No snapshot gap exceeds ${policy.maximumSnapshotGapHours} hour(s).`),
    check("sample-sufficiency", classes.every((item) => item.sufficient), `Every class includes at least ${policy.minimumSamplesPerClass} samples.`),
    check("accuracy-guardrail", classes.every((item) => item.accurate), "Promoted duration and capacity errors remain within policy."),
    check("sustained-improvement", classes.every((item) => item.improved), "Every class sustains paired improvement over the recovered baseline."),
    check("controls-healthy", controls.length > 0 && controls.every((item) => item.healthy), "Corrective controls remain healthy and contributing conditions do not recur."),
    check("incident-guardrail", totalIncidents <= policy.maximumIncidents, `${totalIncidents} incident(s) observed against a limit of ${policy.maximumIncidents}.`),
    check("rollback-current", rollback.targetVersion === promotion.rollback.targetVersion && rollback.owner === promotion.rollback.owner && rollback.maximumRecoveryHours <= promotion.rollback.maximumRecoveryHours && rollbackAgeDays <= policy.maximumRollbackTestAgeDays, "Rollback remains exact, owned, time-bounded, and recently tested."),
    check("independent-review", !excludedReviewers.has(reviewer) && reviewer !== execution.owner, "The outcome reviewer is independent from Project 53 approval and execution."),
  ];
  const allChecksPassed = checks.every((item) => item.passed);
  return {
    schemaVersion: "1.0.0", id, asOf,
    status: decision === "retain" ? (allChecksPassed ? "verified_promotion_outcome" : "blocked_retention") : "action_required",
    sourcePromotionId: promotion.id, baselineVersion: promotion.baselineVersion, promotedVersion: promotion.candidateVersion, scope: promotion.scope,
    policy, execution, snapshots, referenceClasses: classes, rollback: { ...rollback, ageDays: rollbackAgeDays },
    summary: { snapshots: snapshots.length, observationHours, finalAdoptionRate: snapshots.at(-1).adoptionRate, samples: classes.reduce((sum, item) => sum + item.sampleSize, 0), incidents: totalIncidents, allChecksPassed },
    checks,
    review: { reviewer, decision, rationale: text(input.review?.rationale, "review rationale", 1000), reviewedAt },
    method: "deterministic Project 53 authorization, exact activation, version-and-scope, adoption, observation-window, snapshot-continuity, paired-accuracy, sample, control-health, recurrence, incident, rollback-freshness, independent-review, and named human-decision checks; this monitor never activates or reverts a version, changes factors or estimates, changes exposure, removes rollback, or claims causality",
  };
}
