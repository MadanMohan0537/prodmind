const DAY = 86_400_000;

function text(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
}

function number(value, name, min, max) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be a number from ${min} to ${max}`);
  return value;
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function timestamp(value, name) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

const round = (value) => Number(value.toFixed(4));
const mean = (values) => round(values.reduce((sum, value) => sum + value, 0) / values.length);
const errorRate = (estimate, actual) => Math.abs(estimate - actual) / actual;
const percentile = (values, rate) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(rate * sorted.length) - 1)];
};

function normalizeActiveCalibration(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "adopted_calibration" ||
    !Array.isArray(report.referenceClasses) ||
    !report.referenceClasses.length ||
    report.referenceClasses.length > 20
  ) throw new Error("Project 48 requires an adopted bounded Project 44 calibration");
  const classes = new Map();
  for (const [index, raw] of report.referenceClasses.entries()) {
    const referenceClass = text(raw.referenceClass, `Active class ${index + 1} referenceClass`, 80);
    if (classes.has(referenceClass)) throw new Error("Active calibration classes must be unique");
    if (raw.sufficient !== true) throw new Error("Active calibration classes must have sufficient evidence");
    classes.set(referenceClass, {
      durationFactor: number(raw.recommendedDurationFactor, `${referenceClass} active duration factor`, 1, 10),
      capacityFactor: number(raw.recommendedCapacityFactor, `${referenceClass} active capacity factor`, 1, 10),
      sourceCaseIds: evidenceIds(raw.sourceCaseIds, `${referenceClass} sourceCaseIds`),
    });
  }
  return {
    id: text(report.id, "active calibration id", 120),
    asOf: timestamp(report.asOf, "active calibration asOf"),
    classes,
  };
}

function evidenceIds(raw, name) {
  if (!Array.isArray(raw) || !raw.length) throw new Error(`${name} must not be empty`);
  return raw.map((value, index) => text(value, `${name} ${index + 1}`, 240));
}

function normalizeDrift(report, activeCalibration) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "action_required" ||
    report.review?.decision !== "recalibrate" ||
    !Array.isArray(report.recalibrationCandidates) ||
    !report.recalibrationCandidates.length ||
    report.recalibrationCandidates.length > 20
  ) throw new Error("Project 48 requires a Project 47 recalibration decision with candidates");
  const candidates = report.recalibrationCandidates.map((value, index) =>
    text(value, `recalibration candidate ${index + 1}`, 80));
  if (new Set(candidates).size !== candidates.length)
    throw new Error("Project 47 recalibration candidates must be unique");
  if (candidates.some((value) => !activeCalibration.classes.has(value)))
    throw new Error("Every recalibration candidate must exist in the active calibration");
  const asOf = timestamp(report.asOf, "Project 47 asOf");
  if (asOf < activeCalibration.asOf)
    throw new Error("Project 47 drift review cannot precede the active calibration");
  return {
    id: text(report.id, "Project 47 id", 120),
    asOf,
    candidates,
  };
}

function normalizeEvidence(report, activeCalibration, drift) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    !Array.isArray(report.observations) ||
    report.observations.length < 4 ||
    report.observations.length > 200
  ) throw new Error("Project 48 requires a bounded Project 44 evidence report with 4–200 observations");
  const id = text(report.id, "evidence calibration id", 120);
  if (id === activeCalibration.id) throw new Error("Recalibration evidence must be distinct from the active calibration");
  const asOf = timestamp(report.asOf, "evidence calibration asOf");
  if (asOf < drift.asOf) throw new Error("Recalibration evidence cannot precede the Project 47 drift review");
  const seen = new Set();
  const observations = report.observations.map((raw, index) => {
    const portfolioItemId = text(raw.portfolioItemId, `Observation ${index + 1} portfolioItemId`, 240);
    if (seen.has(portfolioItemId)) throw new Error("Recalibration observation IDs must be unique");
    seen.add(portfolioItemId);
    const deliveryAsOf = timestamp(raw.deliveryAsOf, `${portfolioItemId} deliveryAsOf`);
    if (deliveryAsOf > asOf) throw new Error("Observation evidence cannot follow the evidence report");
    return {
      portfolioItemId,
      referenceClass: text(raw.referenceClass, `${portfolioItemId} referenceClass`, 80),
      plannedElapsedDays: number(raw.plannedElapsedDays, `${portfolioItemId} plannedElapsedDays`, 0.1, 10_000),
      actualElapsedDays: number(raw.actualElapsedDays, `${portfolioItemId} actualElapsedDays`, 0.1, 10_000),
      plannedCapacityDays: number(raw.plannedCapacityDays, `${portfolioItemId} plannedCapacityDays`, 0.1, 100_000),
      actualCapacityDays: number(raw.actualCapacityDays, `${portfolioItemId} actualCapacityDays`, 0.1, 100_000),
      deliveryAsOf,
      evidenceIds: evidenceIds(raw.evidenceIds, `${portfolioItemId} evidenceIds`),
      deliveryEvidence: text(raw.deliveryEvidence, `${portfolioItemId} deliveryEvidence`, 1000),
      basis: text(raw.basis, `${portfolioItemId} classification basis`, 1000),
    };
  });
  return { id, asOf, observations };
}

function approval(raw, role, asOf) {
  const reviewedAt = timestamp(raw?.reviewedAt, `${role} approval reviewedAt`);
  if (reviewedAt < asOf) throw new Error(`${role} approval cannot precede controller asOf`);
  const decision = text(raw?.decision, `${role} approval decision`, 20);
  if (!["approve", "reject"].includes(decision)) throw new Error(`${role} approval decision is invalid`);
  return {
    reviewer: text(raw?.reviewer, `${role} approval reviewer`, 120),
    decision,
    rationale: text(raw?.rationale, `${role} approval rationale`, 1000),
    reviewedAt,
  };
}

function evaluateCandidate(referenceClass, rows, active, policy) {
  const ordered = [...rows].sort((left, right) =>
    left.deliveryAsOf.localeCompare(right.deliveryAsOf) || left.portfolioItemId.localeCompare(right.portfolioItemId));
  const split = ordered.length - policy.holdoutItemsPerClass;
  const training = ordered.slice(0, split);
  const holdout = ordered.slice(split);
  const sufficient = training.length >= policy.minimumTrainingItemsPerClass &&
    holdout.length === policy.holdoutItemsPerClass;
  if (!sufficient) {
    return {
      referenceClass,
      sufficient: false,
      trainingSamples: training.length,
      holdoutSamples: holdout.length,
      activeDurationFactor: active.durationFactor,
      activeCapacityFactor: active.capacityFactor,
      candidateDurationFactor: null,
      candidateCapacityFactor: null,
      passed: false,
      sourceObservationIds: ordered.map((row) => row.portfolioItemId),
    };
  }
  const candidateDurationFactor = round(Math.max(1, percentile(
    training.map((row) => row.actualElapsedDays / row.plannedElapsedDays),
    policy.percentileRate,
  )));
  const candidateCapacityFactor = round(Math.max(1, percentile(
    training.map((row) => row.actualCapacityDays / row.plannedCapacityDays),
    policy.percentileRate,
  )));
  const activeDurationErrorRate = mean(holdout.map((row) =>
    errorRate(row.plannedElapsedDays * active.durationFactor, row.actualElapsedDays)));
  const candidateDurationErrorRate = mean(holdout.map((row) =>
    errorRate(row.plannedElapsedDays * candidateDurationFactor, row.actualElapsedDays)));
  const activeCapacityErrorRate = mean(holdout.map((row) =>
    errorRate(row.plannedCapacityDays * active.capacityFactor, row.actualCapacityDays)));
  const candidateCapacityErrorRate = mean(holdout.map((row) =>
    errorRate(row.plannedCapacityDays * candidateCapacityFactor, row.actualCapacityDays)));
  const durationImprovementRate = round(activeDurationErrorRate - candidateDurationErrorRate);
  const capacityImprovementRate = round(activeCapacityErrorRate - candidateCapacityErrorRate);
  const durationChangeRate = round(Math.abs(candidateDurationFactor - active.durationFactor) / active.durationFactor);
  const capacityChangeRate = round(Math.abs(candidateCapacityFactor - active.capacityFactor) / active.capacityFactor);
  const bounded = durationChangeRate <= policy.maximumFactorChangeRate &&
    capacityChangeRate <= policy.maximumFactorChangeRate;
  const accurate = candidateDurationErrorRate <= policy.maximumHoldoutErrorRate &&
    candidateCapacityErrorRate <= policy.maximumHoldoutErrorRate;
  const improved = durationImprovementRate >= policy.minimumHoldoutImprovementRate &&
    capacityImprovementRate >= policy.minimumHoldoutImprovementRate;
  return {
    referenceClass,
    sufficient: true,
    trainingSamples: training.length,
    holdoutSamples: holdout.length,
    trainingThrough: training.at(-1).deliveryAsOf,
    holdoutFrom: holdout[0].deliveryAsOf,
    activeDurationFactor: active.durationFactor,
    candidateDurationFactor,
    durationChangeRate,
    activeDurationErrorRate,
    candidateDurationErrorRate,
    durationImprovementRate,
    activeCapacityFactor: active.capacityFactor,
    candidateCapacityFactor,
    capacityChangeRate,
    activeCapacityErrorRate,
    candidateCapacityErrorRate,
    capacityImprovementRate,
    bounded,
    accurate,
    improved,
    passed: bounded && accurate && improved,
    trainingObservationIds: training.map((row) => row.portfolioItemId),
    holdoutObservationIds: holdout.map((row) => row.portfolioItemId),
    sourceObservationIds: ordered.map((row) => row.portfolioItemId),
  };
}

export function controlRoadmapEstimateRecalibration(
  activeCalibrationReport,
  driftReport,
  evidenceCalibrationReport,
  input = {},
) {
  const id = text(input.id, "controller id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const activeCalibration = normalizeActiveCalibration(activeCalibrationReport);
  const drift = normalizeDrift(driftReport, activeCalibration);
  const evidence = normalizeEvidence(evidenceCalibrationReport, activeCalibration, drift);
  if (asOf < evidence.asOf) throw new Error("Controller asOf cannot precede recalibration evidence");

  const activeVersion = text(input.activeVersion, "activeVersion", 80);
  const proposedVersion = text(input.proposedVersion, "proposedVersion", 80);
  if (activeVersion === proposedVersion) throw new Error("proposedVersion must differ from activeVersion");
  const policy = {
    minimumTrainingItemsPerClass: integer(input.minimumTrainingItemsPerClass, "minimumTrainingItemsPerClass", 2, 100),
    holdoutItemsPerClass: integer(input.holdoutItemsPerClass, "holdoutItemsPerClass", 1, 20),
    percentileRate: number(input.percentileRate, "percentileRate", 0.5, 0.95),
    maximumFactorChangeRate: number(input.maximumFactorChangeRate, "maximumFactorChangeRate", 0, 1),
    minimumHoldoutImprovementRate: number(input.minimumHoldoutImprovementRate, "minimumHoldoutImprovementRate", 0, 1),
    maximumHoldoutErrorRate: number(input.maximumHoldoutErrorRate, "maximumHoldoutErrorRate", 0, 2),
  };
  const validUntil = timestamp(input.validUntil, "validUntil");
  const validityDays = Math.floor((Date.parse(validUntil) - Date.parse(asOf)) / DAY);
  if (validityDays < 1 || validityDays > 180) throw new Error("validUntil must be 1–180 days after asOf");

  const grouped = new Map(drift.candidates.map((candidate) => [candidate, []]));
  for (const row of evidence.observations) {
    if (grouped.has(row.referenceClass)) grouped.get(row.referenceClass).push(row);
  }
  const proposals = drift.candidates.map((referenceClass) => evaluateCandidate(
    referenceClass,
    grouped.get(referenceClass),
    activeCalibration.classes.get(referenceClass),
    policy,
  ));

  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    maximumRecoveryHours: integer(input.rollback?.maximumRecoveryHours, "rollback maximumRecoveryHours", 1, 168),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.targetVersion !== activeVersion)
    throw new Error("Rollback must target the declared activeVersion");

  const approvals = {
    product: approval(input.approvals?.product, "product", asOf),
    engineering: approval(input.approvals?.engineering, "engineering", asOf),
    assurance: approval(input.approvals?.assurance, "assurance", asOf),
  };
  const reviewers = Object.values(approvals).map((entry) => entry.reviewer.toLowerCase());
  const independentApprovals = new Set(reviewers).size === reviewers.length;
  const approvalsComplete = Object.values(approvals).every((entry) => entry.decision === "approve");
  const evidenceLineage = evidence.observations.every((row) =>
    row.evidenceIds.length && row.deliveryEvidence && row.basis);
  const checks = [
    {
      id: "drift-authorization",
      passed: drift.candidates.length > 0,
      detail: `${drift.candidates.length} Project 47 candidate class(es) are explicitly authorized for recalibration.`,
    },
    {
      id: "temporal-holdout",
      passed: proposals.every((entry) => entry.sufficient),
      detail: `${proposals.filter((entry) => entry.sufficient).length} of ${proposals.length} candidate(s) have separate training and later holdout evidence.`,
    },
    {
      id: "bounded-factor-change",
      passed: proposals.every((entry) => entry.bounded),
      detail: `${proposals.filter((entry) => entry.bounded).length} of ${proposals.length} candidate(s) stay within the declared factor-change limit.`,
    },
    {
      id: "holdout-accuracy",
      passed: proposals.every((entry) => entry.accurate),
      detail: `${proposals.filter((entry) => entry.accurate).length} of ${proposals.length} candidate(s) meet holdout error policy.`,
    },
    {
      id: "holdout-improvement",
      passed: proposals.every((entry) => entry.improved),
      detail: `${proposals.filter((entry) => entry.improved).length} of ${proposals.length} candidate(s) improve duration and capacity holdout error.`,
    },
    {
      id: "evidence-lineage",
      passed: evidenceLineage,
      detail: "Every observation retains customer, delivery, and reference-class evidence.",
    },
    {
      id: "rollback-readiness",
      passed: rollback.targetVersion === activeVersion && Boolean(rollback.owner && rollback.evidence),
      detail: `Rollback targets ${rollback.targetVersion} within ${rollback.maximumRecoveryHours} hour(s).`,
    },
    {
      id: "independent-approval",
      passed: independentApprovals && approvalsComplete,
      detail: "Product, Engineering, and Assurance reviewers must be distinct and approve the proposal.",
    },
  ];

  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede controller asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["approve", "revise", "defer"].includes(decision)) throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status: decision === "approve"
      ? (allPassed ? "approved_recalibration" : "blocked_recalibration")
      : "action_required",
    sourceCalibrationId: activeCalibration.id,
    sourceDriftId: drift.id,
    sourceEvidenceCalibrationId: evidence.id,
    activeVersion,
    proposedVersion,
    validUntil,
    policy,
    summary: {
      candidateClasses: proposals.length,
      approvedCandidates: proposals.filter((entry) => entry.passed).length,
      evidenceObservations: evidence.observations.length,
      allChecksPassed: allPassed,
    },
    proposals,
    rollback,
    checks,
    approvals,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic reference-class recalibration proposal using earlier training observations and a later untouched holdout; approval does not activate factors, guarantee future accuracy, establish statistical significance, or change estimates, schedules, assignments, or product state",
  };
}
