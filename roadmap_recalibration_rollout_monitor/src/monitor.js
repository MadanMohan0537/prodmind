const HOUR = 3_600_000;

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
const check = (id, passed, detail) => ({ id, passed, detail });

function normalizeProposal(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "approved_recalibration" ||
    report.review?.decision !== "approve" ||
    !Array.isArray(report.proposals) ||
    !report.proposals.length ||
    report.proposals.length > 20
  ) throw new Error("Project 49 requires an approved Project 48 recalibration report");

  const proposals = new Map();
  for (const [index, raw] of report.proposals.entries()) {
    const referenceClass = text(raw.referenceClass, `Proposal ${index + 1} referenceClass`, 80);
    if (proposals.has(referenceClass)) throw new Error("Project 48 proposal classes must be unique");
    if (raw.passed !== true) throw new Error("Every Project 48 proposal must have passed validation");
    proposals.set(referenceClass, {
      durationFactor: number(raw.candidateDurationFactor, `${referenceClass} duration factor`, 1, 10),
      capacityFactor: number(raw.candidateCapacityFactor, `${referenceClass} capacity factor`, 1, 10),
    });
  }

  return {
    id: text(report.id, "Project 48 id", 120),
    asOf: timestamp(report.asOf, "Project 48 asOf"),
    validUntil: timestamp(report.validUntil, "Project 48 validUntil"),
    activeVersion: text(report.activeVersion, "Project 48 activeVersion", 80),
    proposedVersion: text(report.proposedVersion, "Project 48 proposedVersion", 80),
    rollback: {
      targetVersion: text(report.rollback?.targetVersion, "Project 48 rollback targetVersion", 80),
      maximumRecoveryHours: integer(
        report.rollback?.maximumRecoveryHours,
        "Project 48 rollback maximumRecoveryHours",
        1,
        168,
      ),
    },
    proposals,
  };
}

function normalizeObservations(raw, stageId, proposals) {
  if (!Array.isArray(raw) || raw.length !== proposals.size)
    throw new Error(`${stageId} must report every approved reference class exactly once`);
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `${stageId} observation ${index + 1} referenceClass`, 80);
    if (seen.has(referenceClass) || !proposals.has(referenceClass))
      throw new Error(`${stageId} observation classes must be unique and approved`);
    seen.add(referenceClass);
    const expected = proposals.get(referenceClass);
    return {
      referenceClass,
      sampleSize: integer(item.sampleSize, `${stageId} ${referenceClass} sampleSize`, 1, 1_000_000),
      activeDurationErrorRate: number(
        item.activeDurationErrorRate,
        `${stageId} ${referenceClass} activeDurationErrorRate`,
        0,
        10,
      ),
      candidateDurationErrorRate: number(
        item.candidateDurationErrorRate,
        `${stageId} ${referenceClass} candidateDurationErrorRate`,
        0,
        10,
      ),
      activeCapacityErrorRate: number(
        item.activeCapacityErrorRate,
        `${stageId} ${referenceClass} activeCapacityErrorRate`,
        0,
        10,
      ),
      candidateCapacityErrorRate: number(
        item.candidateCapacityErrorRate,
        `${stageId} ${referenceClass} candidateCapacityErrorRate`,
        0,
        10,
      ),
      candidateDurationFactor: number(
        item.candidateDurationFactor,
        `${stageId} ${referenceClass} candidateDurationFactor`,
        1,
        10,
      ),
      candidateCapacityFactor: number(
        item.candidateCapacityFactor,
        `${stageId} ${referenceClass} candidateCapacityFactor`,
        1,
        10,
      ),
      factorMatch:
        item.candidateDurationFactor === expected.durationFactor &&
        item.candidateCapacityFactor === expected.capacityFactor,
      incidents: integer(item.incidents, `${stageId} ${referenceClass} incidents`, 0, 1_000_000),
      evidence: text(item.evidence, `${stageId} ${referenceClass} evidence`, 1000),
    };
  });
}

function normalizeStages(raw, proposal, asOf, policy) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 10)
    throw new Error("Provide 2–10 rollout stages");
  const ids = new Set();
  let previousEnd = null;
  let previousExposure = -1;
  return raw.map((item, index) => {
    const id = text(item.id, `Stage ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Rollout stage IDs must be unique");
    ids.add(id);
    const mode = text(item.mode, `${id} mode`, 20);
    if (!['shadow', 'active'].includes(mode)) throw new Error(`${id} mode must be shadow or active`);
    const exposureRate = number(item.exposureRate, `${id} exposureRate`, 0, 1);
    if (mode === "shadow" && exposureRate !== 0) throw new Error("Shadow stages must have zero active exposure");
    if (mode === "active" && exposureRate <= previousExposure)
      throw new Error("Active-stage exposure must increase strictly");
    if (mode === "active") previousExposure = exposureRate;
    if (exposureRate > policy.maximumExposureRate)
      throw new Error("A stage exceeds maximumExposureRate");

    const startedAt = timestamp(item.startedAt, `${id} startedAt`);
    const endedAt = timestamp(item.endedAt, `${id} endedAt`);
    if (endedAt <= startedAt) throw new Error(`${id} endedAt must follow startedAt`);
    if (endedAt > asOf) throw new Error("Rollout stages cannot end after asOf");
    if (previousEnd && startedAt < previousEnd) throw new Error("Rollout stages must not overlap");
    previousEnd = endedAt;
    const dwellHours = round((Date.parse(endedAt) - Date.parse(startedAt)) / HOUR);
    return {
      id,
      mode,
      exposureRate,
      version: text(item.version, `${id} version`, 80),
      startedAt,
      endedAt,
      dwellHours,
      observations: normalizeObservations(item.observations, id, proposal.proposals),
      evidence: text(item.evidence, `${id} evidence`, 1000),
    };
  });
}

function summarizeClasses(stages, proposals, policy) {
  return [...proposals.keys()].map((referenceClass) => {
    const rows = stages.map((stage) => stage.observations.find((row) => row.referenceClass === referenceClass));
    const sampleSize = rows.reduce((sum, row) => sum + row.sampleSize, 0);
    const weighted = (field) => round(
      rows.reduce((sum, row) => sum + row[field] * row.sampleSize, 0) / sampleSize,
    );
    const activeDurationErrorRate = weighted("activeDurationErrorRate");
    const candidateDurationErrorRate = weighted("candidateDurationErrorRate");
    const activeCapacityErrorRate = weighted("activeCapacityErrorRate");
    const candidateCapacityErrorRate = weighted("candidateCapacityErrorRate");
    const durationImprovementRate = round(activeDurationErrorRate - candidateDurationErrorRate);
    const capacityImprovementRate = round(activeCapacityErrorRate - candidateCapacityErrorRate);
    return {
      referenceClass,
      sampleSize,
      activeDurationErrorRate,
      candidateDurationErrorRate,
      durationImprovementRate,
      activeCapacityErrorRate,
      candidateCapacityErrorRate,
      capacityImprovementRate,
      incidents: rows.reduce((sum, row) => sum + row.incidents, 0),
      factorsMatch: rows.every((row) => row.factorMatch),
      sufficient: sampleSize >= policy.minimumSamplesPerClass,
      accurate:
        candidateDurationErrorRate <= policy.maximumCandidateErrorRate &&
        candidateCapacityErrorRate <= policy.maximumCandidateErrorRate,
      improved:
        durationImprovementRate >= policy.minimumImprovementRate &&
        capacityImprovementRate >= policy.minimumImprovementRate,
    };
  });
}

export function monitorRoadmapRecalibrationRollout(recalibrationReport, input = {}) {
  const proposal = normalizeProposal(recalibrationReport);
  const id = text(input.id, "monitor id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < proposal.asOf) throw new Error("Monitor asOf cannot precede Project 48");
  const policy = {
    minimumStageDwellHours: integer(input.minimumStageDwellHours, "minimumStageDwellHours", 1, 720),
    minimumSamplesPerClass: integer(input.minimumSamplesPerClass, "minimumSamplesPerClass", 2, 1_000_000),
    maximumExposureRate: number(input.maximumExposureRate, "maximumExposureRate", 0.01, 1),
    maximumCandidateErrorRate: number(input.maximumCandidateErrorRate, "maximumCandidateErrorRate", 0, 2),
    minimumImprovementRate: number(input.minimumImprovementRate, "minimumImprovementRate", 0, 1),
    maximumIncidents: integer(input.maximumIncidents, "maximumIncidents", 0, 10_000),
  };
  const stages = normalizeStages(input.stages, proposal, asOf, policy);
  if (stages[0].mode !== "shadow") throw new Error("The first rollout stage must be shadow evaluation");
  if (stages.slice(1).some((stage) => stage.mode !== "active"))
    throw new Error("Only the first stage may be shadow evaluation");
  const firstStartedAt = stages[0].startedAt;
  const declaration = {
    owner: text(input.declaration?.owner, "declaration owner", 120),
    declaredAt: timestamp(input.declaration?.declaredAt, "declaration declaredAt"),
    baselineVersion: text(input.declaration?.baselineVersion, "declaration baselineVersion", 80),
    targetVersion: text(input.declaration?.targetVersion, "declaration targetVersion", 80),
    evidence: text(input.declaration?.evidence, "declaration evidence", 1000),
  };
  if (declaration.declaredAt > firstStartedAt) throw new Error("Rollout declaration must precede the first stage");

  const rollback = {
    targetVersion: text(input.rollback?.targetVersion, "rollback targetVersion", 80),
    owner: text(input.rollback?.owner, "rollback owner", 120),
    testedAt: timestamp(input.rollback?.testedAt, "rollback testedAt"),
    maximumRecoveryHours: integer(input.rollback?.maximumRecoveryHours, "rollback maximumRecoveryHours", 1, 168),
    evidence: text(input.rollback?.evidence, "rollback evidence", 1000),
  };
  if (rollback.testedAt < proposal.asOf || rollback.testedAt > asOf)
    throw new Error("Rollback test must follow Project 48 and not exceed asOf");

  const classes = summarizeClasses(stages, proposal.proposals, policy);
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("Review cannot precede monitor asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!['promote', 'pause', 'rollback'].includes(decision)) throw new Error("Review decision is invalid");

  const totalIncidents = classes.reduce((sum, item) => sum + item.incidents, 0);
  const checks = [
    check("approved-proposal", true, `Project 48 proposal ${proposal.id} is approved.`),
    check(
      "valid-start",
      firstStartedAt >= proposal.asOf && firstStartedAt <= proposal.validUntil,
      "The rollout begins after approval and before proposal expiry.",
    ),
    check(
      "declared-versions",
      declaration.baselineVersion === proposal.activeVersion && declaration.targetVersion === proposal.proposedVersion,
      "The declaration preserves the approved baseline and target versions.",
    ),
    check(
      "shadow-then-staged",
      stages[0].mode === "shadow" && stages.slice(1).every((stage) => stage.mode === "active") &&
        stages.at(-1).exposureRate === policy.maximumExposureRate,
      "A zero-exposure shadow precedes increasing active stages through the declared ceiling.",
    ),
    check(
      "target-version",
      stages.every((stage) => stage.version === proposal.proposedVersion),
      `Every stage evaluates proposed version ${proposal.proposedVersion}.`,
    ),
    check(
      "exact-factors",
      classes.every((item) => item.factorsMatch),
      "Every observation uses the exact Project 48 candidate factors.",
    ),
    check(
      "minimum-dwell",
      stages.every((stage) => stage.dwellHours >= policy.minimumStageDwellHours),
      `Every stage runs for at least ${policy.minimumStageDwellHours} hour(s).`,
    ),
    check(
      "representative-sample",
      classes.every((item) => item.sufficient),
      `Every class has at least ${policy.minimumSamplesPerClass} paired observations.`,
    ),
    check(
      "candidate-accuracy",
      classes.every((item) => item.accurate),
      "Every candidate remains within the declared error ceiling.",
    ),
    check(
      "paired-improvement",
      classes.every((item) => item.improved),
      "Every candidate improves duration and capacity error against the concurrent active baseline.",
    ),
    check(
      "incident-guardrail",
      totalIncidents <= policy.maximumIncidents,
      `${totalIncidents} incident(s) observed against a limit of ${policy.maximumIncidents}.`,
    ),
    check(
      "tested-rollback",
      rollback.targetVersion === proposal.activeVersion &&
        rollback.maximumRecoveryHours <= proposal.rollback.maximumRecoveryHours,
      `Rollback returns to ${proposal.activeVersion} within the approved recovery limit.`,
    ),
    check(
      "evidence-complete",
      stages.every((stage) => stage.evidence && stage.observations.every((item) => item.evidence)),
      "Every stage and class retains reviewable evidence.",
    ),
  ];
  const allChecksPassed = checks.every((item) => item.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status: decision === "promote"
      ? (allChecksPassed ? "verified_rollout" : "blocked_promotion")
      : "action_required",
    sourceRecalibrationId: proposal.id,
    activeVersion: proposal.activeVersion,
    proposedVersion: proposal.proposedVersion,
    declaration,
    policy,
    summary: {
      stages: stages.length,
      referenceClasses: classes.length,
      totalSamples: classes.reduce((sum, item) => sum + item.sampleSize, 0),
      incidents: totalIncidents,
      allChecksPassed,
    },
    stages,
    referenceClasses: classes,
    rollback,
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic shadow and staged-rollout assurance using exact versions and factors, paired active-versus-candidate errors, dwell, sample, incident, evidence, and tested-rollback gates; this monitor never changes exposure, promotes, pauses, rolls back, edits estimates, or changes product state",
  };
}

