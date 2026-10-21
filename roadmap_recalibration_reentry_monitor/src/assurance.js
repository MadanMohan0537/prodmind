const HOUR = 3_600_000;

function text(value, name, maximum = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${name} must contain 1–${maximum} characters`);
  }
  return value.trim();
}

function timestamp(value, name) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
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
  if (
    report?.schemaVersion !== "1.0.0" ||
    !report.id ||
    !report.sourceRecoveryId ||
    !report.reentry ||
    !Array.isArray(report.actions) ||
    !Array.isArray(report.contributingConditions)
  ) {
    throw new Error("Provide a bounded Project 51 recalibration re-entry report");
  }

  const conditions = uniqueStrings(
    report.contributingConditions.map((item) => item.id),
    "Project 51 contributing conditions",
    30,
  );
  const actionIds = new Set(report.actions.map((item) => item.id));
  const requiredActionIds = uniqueStrings(
    report.reentry.requiredActionIds,
    "Project 51 required action IDs",
    50,
  );
  if (requiredActionIds.some((id) => !actionIds.has(id))) {
    throw new Error("Project 51 required actions must exist in its action register");
  }

  const monitors = uniqueStrings(report.reentry.monitors, "Project 51 monitors", 20);
  const requiredMonitors = ["duration_error", "capacity_error", "incidents"];
  if (requiredMonitors.some((name) => !monitors.includes(name))) {
    throw new Error("Project 51 must require duration, capacity, and incident monitoring");
  }

  return {
    id: text(report.id, "Project 51 id", 120),
    asOf: timestamp(report.asOf, "Project 51 asOf"),
    status: text(report.status, "Project 51 status", 30),
    decision: text(report.review?.decision, "Project 51 decision", 30),
    reviewer: text(report.review?.reviewer, "Project 51 reviewer", 120),
    sourceRecoveryId: text(report.sourceRecoveryId, "Project 51 sourceRecoveryId", 120),
    sourceRecalibrationId: text(
      report.sourceRecalibrationId,
      "Project 51 sourceRecalibrationId",
      120,
    ),
    sourceRolloutId: text(report.sourceRolloutId, "Project 51 sourceRolloutId", 120),
    recoveredVersion: text(report.recoveredVersion, "Project 51 recoveredVersion", 80),
    failedVersion: text(report.failedVersion, "Project 51 failedVersion", 80),
    conditions,
    requiredActionIds,
    monitors,
    approvals: Array.isArray(report.approvals)
      ? report.approvals.map((item) => text(item.reviewer, "Project 51 approval reviewer", 120))
      : [],
    reentry: {
      owner: text(report.reentry.owner, "Project 51 re-entry owner", 120),
      baselineVersion: text(report.reentry.baselineVersion, "Project 51 baselineVersion", 80),
      candidateVersion: text(report.reentry.candidateVersion, "Project 51 candidateVersion", 80),
      scope: uniqueStrings(report.reentry.scope, "Project 51 re-entry scope", 50),
      startsAt: timestamp(report.reentry.startsAt, "Project 51 re-entry startsAt"),
      shadowRequired: report.reentry.shadowRequired === true,
      initialExposureRate: number(
        report.reentry.initialExposureRate,
        "Project 51 initialExposureRate",
        0,
        1,
      ),
      rollback: {
        targetVersion: text(
          report.reentry.rollback?.targetVersion,
          "Project 51 rollback targetVersion",
          80,
        ),
        owner: text(report.reentry.rollback?.owner, "Project 51 rollback owner", 120),
        maximumRecoveryHours: number(
          report.reentry.rollback?.maximumRecoveryHours,
          "Project 51 rollback maximumRecoveryHours",
          0.01,
          168,
        ),
      },
    },
  };
}

function normalizeClassObservations(raw, stageId, scope) {
  if (!Array.isArray(raw) || raw.length !== scope.length) {
    throw new Error(`${stageId} must report every approved reference class exactly once`);
  }
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(
      item.referenceClass,
      `${stageId} observation ${index + 1} referenceClass`,
      120,
    );
    if (seen.has(referenceClass) || !scope.includes(referenceClass)) {
      throw new Error(`${stageId} reference classes must be unique and approved`);
    }
    seen.add(referenceClass);
    return {
      referenceClass,
      sampleSize: integer(item.sampleSize, `${stageId} ${referenceClass} sampleSize`, 1, 1_000_000),
      baselineDurationErrorRate: number(
        item.baselineDurationErrorRate,
        `${stageId} ${referenceClass} baselineDurationErrorRate`,
        0,
        10,
      ),
      candidateDurationErrorRate: number(
        item.candidateDurationErrorRate,
        `${stageId} ${referenceClass} candidateDurationErrorRate`,
        0,
        10,
      ),
      baselineCapacityErrorRate: number(
        item.baselineCapacityErrorRate,
        `${stageId} ${referenceClass} baselineCapacityErrorRate`,
        0,
        10,
      ),
      candidateCapacityErrorRate: number(
        item.candidateCapacityErrorRate,
        `${stageId} ${referenceClass} candidateCapacityErrorRate`,
        0,
        10,
      ),
      incidents: integer(item.incidents, `${stageId} ${referenceClass} incidents`, 0, 1_000_000),
      evidence: text(item.evidence, `${stageId} ${referenceClass} evidence`, 1000),
    };
  });
}

function normalizeSignals(raw, stageId, conditionIds) {
  if (!Array.isArray(raw) || raw.length !== conditionIds.length) {
    throw new Error(`${stageId} must report every Project 51 contributing condition`);
  }
  const seen = new Set();
  return raw.map((item, index) => {
    const conditionId = text(item.conditionId, `${stageId} signal ${index + 1} conditionId`, 80);
    if (seen.has(conditionId) || !conditionIds.includes(conditionId)) {
      throw new Error(`${stageId} recurrence signals must be unique and declared`);
    }
    seen.add(conditionId);
    return {
      conditionId,
      detected: item.detected === true,
      evidence: text(item.evidence, `${stageId} ${conditionId} signal evidence`, 1000),
    };
  });
}

function normalizeControls(raw, stageId, requiredActionIds) {
  if (!Array.isArray(raw) || raw.length !== requiredActionIds.length) {
    throw new Error(`${stageId} must report every re-entry corrective action`);
  }
  const seen = new Set();
  return raw.map((item, index) => {
    const actionId = text(item.actionId, `${stageId} control ${index + 1} actionId`, 80);
    if (seen.has(actionId) || !requiredActionIds.includes(actionId)) {
      throw new Error(`${stageId} action controls must be unique and required`);
    }
    seen.add(actionId);
    return {
      actionId,
      operational: item.operational === true,
      evidence: text(item.evidence, `${stageId} ${actionId} control evidence`, 1000),
    };
  });
}

function normalizeStages(raw, learning, asOf, policy) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 10) {
    throw new Error("Provide 2–10 re-entry stages");
  }
  const ids = new Set();
  let previousEnd = null;
  let previousExposure = -1;

  return raw.map((item, index) => {
    const id = text(item.id, `stage ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Re-entry stage IDs must be unique");
    ids.add(id);

    const mode = text(item.mode, `${id} mode`, 20);
    if (!["shadow", "active"].includes(mode)) throw new Error(`${id} mode is invalid`);
    const exposureRate = number(item.exposureRate, `${id} exposureRate`, 0, 1);
    if (mode === "shadow" && exposureRate !== 0) {
      throw new Error("Shadow stages must have zero active exposure");
    }
    if (mode === "active" && exposureRate <= previousExposure) {
      throw new Error("Active-stage exposure must increase strictly");
    }
    if (mode === "active") previousExposure = exposureRate;

    const startedAt = timestamp(item.startedAt, `${id} startedAt`);
    const endedAt = timestamp(item.endedAt, `${id} endedAt`);
    if (endedAt <= startedAt || endedAt > asOf) throw new Error(`${id} timing is invalid`);
    const gapHours = previousEnd ? hoursBetween(previousEnd, startedAt) : 0;
    if (previousEnd && startedAt < previousEnd) throw new Error("Re-entry stages must not overlap");
    previousEnd = endedAt;

    return {
      id,
      mode,
      exposureRate,
      version: text(item.version, `${id} version`, 80),
      startedAt,
      endedAt,
      dwellHours: hoursBetween(startedAt, endedAt),
      gapHours,
      classObservations: normalizeClassObservations(
        item.classObservations,
        id,
        learning.reentry.scope,
      ),
      recurrenceSignals: normalizeSignals(item.recurrenceSignals, id, learning.conditions),
      actionControls: normalizeControls(item.actionControls, id, learning.requiredActionIds),
      evidence: text(item.evidence, `${id} evidence`, 1000),
      withinExposure:
        exposureRate <= policy.maximumExposureRate &&
        exposureRate <= learning.reentry.initialExposureRate,
    };
  });
}

function summarizeClasses(stages, scope, policy) {
  return scope.map((referenceClass) => {
    const rows = stages.map((stage) => (
      stage.classObservations.find((item) => item.referenceClass === referenceClass)
    ));
    const sampleSize = rows.reduce((sum, row) => sum + row.sampleSize, 0);
    const weighted = (field) => round(
      rows.reduce((sum, row) => sum + row[field] * row.sampleSize, 0) / sampleSize,
    );
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
      accurate:
        candidateDurationErrorRate <= policy.maximumCandidateErrorRate &&
        candidateCapacityErrorRate <= policy.maximumCandidateErrorRate,
      improved:
        baselineDurationErrorRate - candidateDurationErrorRate >= policy.minimumImprovementRate &&
        baselineCapacityErrorRate - candidateCapacityErrorRate >= policy.minimumImprovementRate,
    };
  });
}

export function assureRoadmapRecalibrationReentry(learningReport, input = {}) {
  const learning = normalizeLearning(learningReport);
  const id = text(input.id, "assurance id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < learning.asOf) throw new Error("asOf cannot precede Project 51");

  const policy = {
    minimumStageDwellHours: integer(
      input.minimumStageDwellHours,
      "minimumStageDwellHours",
      1,
      720,
    ),
    maximumStageGapHours: integer(input.maximumStageGapHours, "maximumStageGapHours", 0, 168),
    minimumSamplesPerClass: integer(
      input.minimumSamplesPerClass,
      "minimumSamplesPerClass",
      2,
      1_000_000,
    ),
    maximumExposureRate: number(input.maximumExposureRate, "maximumExposureRate", 0.01, 1),
    maximumCandidateErrorRate: number(
      input.maximumCandidateErrorRate,
      "maximumCandidateErrorRate",
      0,
      2,
    ),
    minimumImprovementRate: number(
      input.minimumImprovementRate,
      "minimumImprovementRate",
      0,
      1,
    ),
    maximumIncidents: integer(input.maximumIncidents, "maximumIncidents", 0, 10_000),
  };

  const declaration = {
    sourceLearningId: text(input.declaration?.sourceLearningId, "declaration sourceLearningId", 120),
    owner: text(input.declaration?.owner, "declaration owner", 120),
    baselineVersion: text(input.declaration?.baselineVersion, "declaration baselineVersion", 80),
    candidateVersion: text(input.declaration?.candidateVersion, "declaration candidateVersion", 80),
    scope: uniqueStrings(input.declaration?.scope, "declaration scope", 50),
    declaredAt: timestamp(input.declaration?.declaredAt, "declaration declaredAt"),
    evidence: text(input.declaration?.evidence, "declaration evidence", 1000),
  };

  const stages = normalizeStages(input.stages, learning, asOf, policy);
  if (stages[0].mode !== "shadow" || stages.slice(1).some((stage) => stage.mode !== "active")) {
    throw new Error("Re-entry requires one shadow stage followed by active stages");
  }

  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    testedAt: timestamp(input.rollback?.testedAt, "rollback testedAt"),
    maximumRecoveryHours: number(
      input.rollback?.maximumRecoveryHours,
      "rollback maximumRecoveryHours",
      0.01,
      168,
    ),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.testedAt < learning.asOf || rollback.testedAt > asOf) {
    throw new Error("Rollback test must follow Project 51 and not exceed asOf");
  }

  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("Review cannot precede assurance asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["continue", "pause", "rollback"].includes(decision)) {
    throw new Error("Review decision is invalid");
  }
  const reviewer = text(input.review?.reviewer, "review reviewer", 120);

  const classes = summarizeClasses(stages, learning.reentry.scope, policy);
  const totalIncidents = classes.reduce((sum, item) => sum + item.incidents, 0);
  const controls = stages.flatMap((stage) => stage.actionControls);
  const signals = stages.flatMap((stage) => stage.recurrenceSignals);
  const exactScope =
    declaration.scope.length === learning.reentry.scope.length &&
    declaration.scope.every((value) => learning.reentry.scope.includes(value));
  const excludedReviewers = new Set([learning.reviewer, ...learning.approvals]);

  const checks = [
    check(
      "approved-reentry",
      learning.status === "ready_for_reentry" && learning.decision === "approve_reentry",
      "Project 51 must explicitly approve bounded re-entry.",
    ),
    check(
      "exact-declaration",
      declaration.sourceLearningId === learning.id &&
        declaration.owner === learning.reentry.owner &&
        declaration.baselineVersion === learning.reentry.baselineVersion &&
        declaration.candidateVersion === learning.reentry.candidateVersion &&
        exactScope,
      "The declaration preserves Project 51 identity, owner, versions, and scope.",
    ),
    check(
      "pre-exposure-declaration",
      declaration.declaredAt >= learning.asOf && declaration.declaredAt <= stages[0].startedAt,
      "The re-entry trial is declared after approval and before exposure.",
    ),
    check(
      "approved-start",
      stages[0].startedAt >= learning.reentry.startsAt,
      `Re-entry cannot begin before ${learning.reentry.startsAt}.`,
    ),
    check(
      "exact-version",
      stages.every((stage) => stage.version === learning.reentry.candidateVersion),
      "Every stage uses the Project 51 candidate version.",
    ),
    check(
      "bounded-exposure",
      learning.reentry.shadowRequired && stages.every((stage) => stage.withinExposure),
      "Shadow and active exposure stay within both Project 51 and assurance limits.",
    ),
    check(
      "stage-dwell",
      stages.every((stage) => stage.dwellHours >= policy.minimumStageDwellHours),
      `Every stage lasts at least ${policy.minimumStageDwellHours} hour(s).`,
    ),
    check(
      "stage-continuity",
      stages.every((stage) => stage.gapHours <= policy.maximumStageGapHours),
      `Every inter-stage gap is at most ${policy.maximumStageGapHours} hour(s).`,
    ),
    check(
      "sample-sufficiency",
      classes.every((item) => item.sufficient),
      `Every reference class includes at least ${policy.minimumSamplesPerClass} samples.`,
    ),
    check(
      "accuracy-guardrail",
      classes.every((item) => item.accurate),
      "Candidate duration and capacity errors remain within policy.",
    ),
    check(
      "paired-improvement",
      classes.every((item) => item.improved),
      "Every class improves duration and capacity error against the recovered baseline.",
    ),
    check(
      "corrective-controls-operational",
      controls.length > 0 && controls.every((item) => item.operational),
      "Every Project 51 re-entry action remains operational in every stage.",
    ),
    check(
      "no-recurrence",
      signals.length > 0 && signals.every((item) => !item.detected),
      "No Project 51 contributing condition recurs.",
    ),
    check(
      "incident-guardrail",
      totalIncidents <= policy.maximumIncidents,
      `${totalIncidents} incident(s) observed against a limit of ${policy.maximumIncidents}.`,
    ),
    check(
      "rollback-ready",
      rollback.targetVersion === learning.reentry.rollback.targetVersion &&
        rollback.owner === learning.reentry.rollback.owner &&
        rollback.maximumRecoveryHours <= learning.reentry.rollback.maximumRecoveryHours,
      "Tested rollback preserves the recovered baseline, owner, and recovery-time limit.",
    ),
    check(
      "independent-review",
      !excludedReviewers.has(reviewer),
      "The assurance reviewer is independent from Project 51 review and approvals.",
    ),
  ];
  const allChecksPassed = checks.every((item) => item.passed);

  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status:
      decision === "continue"
        ? allChecksPassed
          ? "verified_reentry"
          : "blocked_continue"
        : "action_required",
    sourceLearningId: learning.id,
    sourceRecoveryId: learning.sourceRecoveryId,
    sourceRecalibrationId: learning.sourceRecalibrationId,
    sourceRolloutId: learning.sourceRolloutId,
    policy,
    declaration,
    stages,
    referenceClasses: classes,
    rollback,
    summary: {
      stages: stages.length,
      referenceClasses: classes.length,
      samples: classes.reduce((sum, item) => sum + item.sampleSize, 0),
      incidents: totalIncidents,
      recurrenceSignals: signals.filter((item) => item.detected).length,
      allChecksPassed,
    },
    checks,
    review: {
      reviewer,
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic Project 51 lineage, pre-exposure declaration, exact owner/version/scope, shadow-first bounded exposure, stage dwell and continuity, paired accuracy, sample, corrective-control, recurrence, incident, rollback, evidence, independent-review, and named human-decision checks; this monitor never changes exposure, activates or promotes a version, edits estimates, pauses or rolls back a trial, assigns blame, or claims causality",
  };
}
