const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function text(value, name, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${name} must contain 1–${maximum} characters`);
  }
  return value.trim();
}

function timestamp(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

function number(value, name, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number from ${minimum} to ${maximum}`);
  }
  return value;
}

function integer(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

const round = (value) => Number(value.toFixed(4));
const hoursBetween = (start, end) => round((Date.parse(end) - Date.parse(start)) / HOUR);
const check = (id, passed, detail) => ({ id, passed, detail });

function uniqueStrings(raw, name, maximum = 50) {
  if (!Array.isArray(raw) || !raw.length || raw.length > maximum) {
    throw new Error(`${name} must contain 1–${maximum} values`);
  }
  const values = raw.map((value, index) => text(value, `${name} ${index + 1}`, 120));
  if (new Set(values).size !== values.length) throw new Error(`${name} values must be unique`);
  return values;
}

function normalizeLearning(report) {
  if (report?.schemaVersion !== "1.0.0" || !report.id || !report.reentry || !report.review) {
    throw new Error("Provide a bounded Project 51 recalibration re-entry report");
  }
  return {
    id: text(report.id, "Project 51 id", 120),
    status: text(report.status, "Project 51 status", 30),
    reviewer: text(report.review.reviewer, "Project 51 reviewer", 120),
    approvalReviewers: (report.approvals ?? []).map((item) => text(item.reviewer, "Project 51 approval reviewer", 120)),
    conditions: uniqueStrings(report.contributingConditions?.map((item) => item.id), "Project 51 conditions", 30),
    actionIds: uniqueStrings(report.reentry.requiredActionIds, "Project 51 required action IDs", 50),
    baselineVersion: text(report.reentry.baselineVersion, "Project 51 baselineVersion", 80),
    candidateVersion: text(report.reentry.candidateVersion, "Project 51 candidateVersion", 80),
    scope: uniqueStrings(report.reentry.scope, "Project 51 scope", 50),
  };
}

function normalizeAssurance(report, learning) {
  if (report?.schemaVersion !== "1.0.0" || !report.id || !report.declaration || !report.review) {
    throw new Error("Provide a bounded Project 52 recalibration re-entry assurance report");
  }
  return {
    id: text(report.id, "Project 52 id", 120),
    asOf: timestamp(report.asOf, "Project 52 asOf"),
    status: text(report.status, "Project 52 status", 30),
    decision: text(report.review.decision, "Project 52 decision", 30),
    reviewer: text(report.review.reviewer, "Project 52 reviewer", 120),
    reviewedAt: timestamp(report.review.reviewedAt, "Project 52 reviewedAt"),
    sourceLearningId: text(report.sourceLearningId, "Project 52 sourceLearningId", 120),
    baselineVersion: text(report.declaration.baselineVersion, "Project 52 baselineVersion", 80),
    candidateVersion: text(report.declaration.candidateVersion, "Project 52 candidateVersion", 80),
    scope: uniqueStrings(report.declaration.scope, "Project 52 scope", 50),
    rollback: {
      targetVersion: text(report.rollback?.targetVersion, "Project 52 rollback targetVersion", 80),
      owner: text(report.rollback?.owner, "Project 52 rollback owner", 120),
      maximumRecoveryHours: number(report.rollback?.maximumRecoveryHours, "Project 52 rollback maximumRecoveryHours", 0.01, 168),
    },
    lineageMatches: report.sourceLearningId === learning.id,
  };
}

function normalizeOutcomes(raw, id, scope) {
  if (!Array.isArray(raw) || raw.length !== scope.length) {
    throw new Error(`${id} must report every approved reference class exactly once`);
  }
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `${id} outcome ${index + 1} referenceClass`, 120);
    if (seen.has(referenceClass) || !scope.includes(referenceClass)) {
      throw new Error(`${id} reference classes must be unique and approved`);
    }
    seen.add(referenceClass);
    return {
      referenceClass,
      sampleSize: integer(item.sampleSize, `${id} ${referenceClass} sampleSize`, 1, 1_000_000),
      baselineDurationErrorRate: number(item.baselineDurationErrorRate, `${id} baselineDurationErrorRate`, 0, 10),
      candidateDurationErrorRate: number(item.candidateDurationErrorRate, `${id} candidateDurationErrorRate`, 0, 10),
      baselineCapacityErrorRate: number(item.baselineCapacityErrorRate, `${id} baselineCapacityErrorRate`, 0, 10),
      candidateCapacityErrorRate: number(item.candidateCapacityErrorRate, `${id} candidateCapacityErrorRate`, 0, 10),
      incidents: integer(item.incidents, `${id} ${referenceClass} incidents`, 0, 1_000_000),
      evidence: text(item.evidence, `${id} ${referenceClass} evidence`, 1000),
    };
  });
}

function exactEvidence(raw, expectedIds, key, id, label) {
  if (!Array.isArray(raw) || raw.length !== expectedIds.length) {
    throw new Error(`${id} must report every ${label}`);
  }
  const seen = new Set();
  return raw.map((item, index) => {
    const value = text(item[key], `${id} ${label} ${index + 1}`, 120);
    if (seen.has(value) || !expectedIds.includes(value)) {
      throw new Error(`${id} ${label} must be unique and declared`);
    }
    seen.add(value);
    return {
      [key]: value,
      healthy: item.healthy === true,
      evidence: text(item.evidence, `${id} ${value} evidence`, 1000),
    };
  });
}

function normalizeCheckpoints(raw, learning, assurance, asOf, policy) {
  if (!Array.isArray(raw) || raw.length < policy.minimumCheckpoints || raw.length > 20) {
    throw new Error(`Provide ${policy.minimumCheckpoints}–20 stabilization checkpoints`);
  }
  const ids = new Set();
  let previous = assurance.reviewedAt;
  return raw.map((item, index) => {
    const id = text(item.id, `checkpoint ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Checkpoint IDs must be unique");
    ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`);
    if (observedAt <= previous || observedAt > asOf) throw new Error("Checkpoints must be chronological after Project 52 review");
    const gapHours = hoursBetween(previous, observedAt);
    previous = observedAt;
    return {
      id,
      observedAt,
      gapHours,
      version: text(item.version, `${id} version`, 80),
      scope: uniqueStrings(item.scope, `${id} scope`, 50),
      outcomes: normalizeOutcomes(item.outcomes, id, learning.scope),
      recurrenceControls: exactEvidence(item.recurrenceControls, learning.conditions, "conditionId", id, "recurrence conditions"),
      correctiveControls: exactEvidence(item.correctiveControls, learning.actionIds, "actionId", id, "corrective controls"),
      evidence: text(item.evidence, `${id} evidence`, 1000),
      withinGap: gapHours <= policy.maximumCheckpointGapHours,
      exactVersion: item.version === assurance.candidateVersion,
      exactScope: item.scope?.length === learning.scope.length && item.scope.every((value) => learning.scope.includes(value)),
    };
  });
}

function summarizeClasses(checkpoints, scope, policy) {
  return scope.map((referenceClass) => {
    const rows = checkpoints.map((checkpoint) => checkpoint.outcomes.find((item) => item.referenceClass === referenceClass));
    const sampleSize = rows.reduce((sum, row) => sum + row.sampleSize, 0);
    const weighted = (field) => round(rows.reduce((sum, row) => sum + row[field] * row.sampleSize, 0) / sampleSize);
    const baselineDurationErrorRate = weighted("baselineDurationErrorRate");
    const candidateDurationErrorRate = weighted("candidateDurationErrorRate");
    const baselineCapacityErrorRate = weighted("baselineCapacityErrorRate");
    const candidateCapacityErrorRate = weighted("candidateCapacityErrorRate");
    return {
      referenceClass,
      sampleSize,
      baselineDurationErrorRate,
      candidateDurationErrorRate,
      durationImprovementRate: round(baselineDurationErrorRate - candidateDurationErrorRate),
      baselineCapacityErrorRate,
      candidateCapacityErrorRate,
      capacityImprovementRate: round(baselineCapacityErrorRate - candidateCapacityErrorRate),
      incidents: rows.reduce((sum, row) => sum + row.incidents, 0),
      sufficient: sampleSize >= policy.minimumSamplesPerClass,
      accurate: candidateDurationErrorRate <= policy.maximumCandidateErrorRate && candidateCapacityErrorRate <= policy.maximumCandidateErrorRate,
      improved: baselineDurationErrorRate - candidateDurationErrorRate >= policy.minimumImprovementRate && baselineCapacityErrorRate - candidateCapacityErrorRate >= policy.minimumImprovementRate,
    };
  });
}

function normalizeApprovals(raw, asOf) {
  const requiredRoles = ["product", "delivery", "assurance"];
  if (!Array.isArray(raw) || raw.length !== requiredRoles.length) throw new Error("Provide product, delivery, and assurance approvals");
  const roles = new Set();
  return raw.map((item, index) => {
    const role = text(item.role, `approval ${index + 1} role`, 30);
    if (roles.has(role) || !requiredRoles.includes(role)) throw new Error("Approval roles must be unique and required");
    roles.add(role);
    const approvedAt = timestamp(item.approvedAt, `${role} approvedAt`);
    if (approvedAt > asOf) throw new Error("Approvals cannot follow asOf");
    return {
      role,
      reviewer: text(item.reviewer, `${role} reviewer`, 120),
      decision: text(item.decision, `${role} decision`, 20),
      approvedAt,
      evidence: text(item.evidence, `${role} evidence`, 1000),
    };
  });
}

export function controlRoadmapRecalibrationReentryPromotion(learningReport, assuranceReport, input = {}) {
  const learning = normalizeLearning(learningReport);
  const assurance = normalizeAssurance(assuranceReport, learning);
  const id = text(input.id, "promotion id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf <= assurance.reviewedAt) throw new Error("asOf must follow Project 52 review");

  const policy = {
    minimumStabilizationHours: integer(input.minimumStabilizationHours, "minimumStabilizationHours", 24, 2160),
    maximumCheckpointGapHours: integer(input.maximumCheckpointGapHours, "maximumCheckpointGapHours", 1, 720),
    minimumCheckpoints: integer(input.minimumCheckpoints, "minimumCheckpoints", 2, 20),
    minimumSamplesPerClass: integer(input.minimumSamplesPerClass, "minimumSamplesPerClass", 2, 1_000_000),
    maximumCandidateErrorRate: number(input.maximumCandidateErrorRate, "maximumCandidateErrorRate", 0, 2),
    minimumImprovementRate: number(input.minimumImprovementRate, "minimumImprovementRate", 0, 1),
    maximumIncidents: integer(input.maximumIncidents, "maximumIncidents", 0, 10_000),
    maximumRollbackTestAgeDays: integer(input.maximumRollbackTestAgeDays, "maximumRollbackTestAgeDays", 1, 90),
  };
  const checkpoints = normalizeCheckpoints(input.checkpoints, learning, assurance, asOf, policy);
  const classes = summarizeClasses(checkpoints, learning.scope, policy);
  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    testedAt: timestamp(input.rollback?.testedAt, "rollback testedAt"),
    maximumRecoveryHours: number(input.rollback?.maximumRecoveryHours, "rollback maximumRecoveryHours", 0.01, 168),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.testedAt > asOf) throw new Error("Rollback test cannot follow asOf");
  const approvals = normalizeApprovals(input.approvals, asOf);
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("Review cannot precede promotion asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!["promote", "extend_monitoring", "rollback"].includes(decision)) throw new Error("Review decision is invalid");
  const reviewer = text(input.review?.reviewer, "review reviewer", 120);

  const controls = checkpoints.flatMap((item) => [...item.recurrenceControls, ...item.correctiveControls]);
  const totalIncidents = classes.reduce((sum, item) => sum + item.incidents, 0);
  const excluded = new Set([learning.reviewer, ...learning.approvalReviewers, assurance.reviewer]);
  const approvalReviewers = approvals.map((item) => item.reviewer);
  const independentApprovals = new Set(approvalReviewers).size === approvals.length && approvalReviewers.every((name) => !excluded.has(name));
  const stabilizationHours = hoursBetween(assurance.reviewedAt, checkpoints.at(-1).observedAt);
  const rollbackAgeDays = round((Date.parse(asOf) - Date.parse(rollback.testedAt)) / DAY);

  const checks = [
    check("verified-reentry", assurance.status === "verified_reentry" && assurance.decision === "continue", "Project 52 must verify the observed retry and record a human continue decision."),
    check("exact-lineage", learning.status === "ready_for_reentry" && assurance.lineageMatches, "Projects 51 and 52 preserve the same re-entry identity."),
    check("exact-version-and-scope", assurance.baselineVersion === learning.baselineVersion && assurance.candidateVersion === learning.candidateVersion && checkpoints.every((item) => item.exactVersion && item.exactScope), "Every stabilization checkpoint preserves the approved candidate and scope."),
    check("stabilization-window", stabilizationHours >= policy.minimumStabilizationHours, `The stabilization window covers ${stabilizationHours} hour(s).`),
    check("checkpoint-continuity", checkpoints.every((item) => item.withinGap), `No checkpoint gap exceeds ${policy.maximumCheckpointGapHours} hour(s).`),
    check("sample-sufficiency", classes.every((item) => item.sufficient), `Every class includes at least ${policy.minimumSamplesPerClass} stabilization samples.`),
    check("accuracy-guardrail", classes.every((item) => item.accurate), "Candidate duration and capacity errors remain within policy."),
    check("sustained-improvement", classes.every((item) => item.improved), "Every class sustains paired improvement over the recovered baseline."),
    check("controls-healthy", controls.length > 0 && controls.every((item) => item.healthy), "Corrective controls remain operational and contributing conditions do not recur."),
    check("incident-guardrail", totalIncidents <= policy.maximumIncidents, `${totalIncidents} incident(s) observed against a limit of ${policy.maximumIncidents}.`),
    check("rollback-current", rollback.targetVersion === assurance.rollback.targetVersion && rollback.owner === assurance.rollback.owner && rollback.maximumRecoveryHours <= assurance.rollback.maximumRecoveryHours && rollbackAgeDays <= policy.maximumRollbackTestAgeDays, "Rollback remains exact, owned, time-bounded, and recently tested."),
    check("independent-approvals", approvals.every((item) => item.decision === "approve") && independentApprovals, "Product, Delivery, and Assurance approvals are affirmative and independent."),
    check("independent-review", !excluded.has(reviewer) && !approvalReviewers.includes(reviewer), "The final reviewer is independent from upstream and promotion approvers."),
  ];
  const allChecksPassed = checks.every((item) => item.passed);

  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status: decision === "promote" ? (allChecksPassed ? "ready_for_promotion" : "blocked_promotion") : "action_required",
    sourceAssuranceId: assurance.id,
    sourceLearningId: learning.id,
    baselineVersion: learning.baselineVersion,
    candidateVersion: learning.candidateVersion,
    scope: learning.scope,
    policy,
    checkpoints,
    referenceClasses: classes,
    rollback: { ...rollback, ageDays: rollbackAgeDays },
    approvals,
    summary: {
      checkpoints: checkpoints.length,
      stabilizationHours,
      samples: classes.reduce((sum, item) => sum + item.sampleSize, 0),
      incidents: totalIncidents,
      allChecksPassed,
    },
    checks,
    review: {
      reviewer,
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method: "deterministic Project 51/52 lineage, sustained-window, checkpoint-continuity, exact-version-and-scope, paired-accuracy, sample, control-health, recurrence, incident, rollback-freshness, independent-approval, and named human-decision checks; this controller never activates or promotes a version, changes factors or estimates, removes rollback, extends exposure, or claims causality",
  };
}
