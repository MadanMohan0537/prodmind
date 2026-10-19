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

function normalizeRecalibration(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "approved_recalibration" ||
    !Array.isArray(report.proposals) ||
    !report.proposals.length ||
    report.proposals.length > 20
  ) throw new Error("Project 50 requires an approved Project 48 recalibration report");
  const classes = new Map();
  for (const [index, raw] of report.proposals.entries()) {
    const referenceClass = text(raw.referenceClass, `Project 48 proposal ${index + 1} referenceClass`, 80);
    if (classes.has(referenceClass)) throw new Error("Project 48 proposal classes must be unique");
    if (raw.passed !== true) throw new Error("Every Project 48 proposal must have passed");
    classes.set(referenceClass, {
      durationFactor: number(raw.activeDurationFactor, `${referenceClass} activeDurationFactor`, 1, 10),
      capacityFactor: number(raw.activeCapacityFactor, `${referenceClass} activeCapacityFactor`, 1, 10),
    });
  }
  return {
    id: text(report.id, "Project 48 id", 120),
    asOf: timestamp(report.asOf, "Project 48 asOf"),
    activeVersion: text(report.activeVersion, "Project 48 activeVersion", 80),
    proposedVersion: text(report.proposedVersion, "Project 48 proposedVersion", 80),
    classes,
  };
}

function normalizeRollout(report, recalibration) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "action_required" ||
    report.review?.decision !== "rollback" ||
    report.sourceRecalibrationId !== recalibration.id
  ) throw new Error("Project 50 requires a matching Project 49 human rollback decision");
  if (report.activeVersion !== recalibration.activeVersion || report.proposedVersion !== recalibration.proposedVersion)
    throw new Error("Project 49 versions must match Project 48");
  const asOf = timestamp(report.asOf, "Project 49 asOf");
  if (asOf < recalibration.asOf) throw new Error("Project 49 cannot precede Project 48");
  return {
    id: text(report.id, "Project 49 id", 120),
    asOf,
    reviewedAt: timestamp(report.review.reviewedAt, "Project 49 review reviewedAt"),
    rollback: {
      targetVersion: text(report.rollback?.targetVersion, "Project 49 rollback targetVersion", 80),
      owner: text(report.rollback?.owner, "Project 49 rollback owner", 120),
      maximumRecoveryHours: integer(
        report.rollback?.maximumRecoveryHours,
        "Project 49 rollback maximumRecoveryHours",
        1,
        168,
      ),
    },
  };
}

function normalizeRestorations(raw, classes) {
  if (!Array.isArray(raw) || raw.length !== classes.size)
    throw new Error("Factor restorations must cover every approved reference class exactly once");
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `Restoration ${index + 1} referenceClass`, 80);
    if (seen.has(referenceClass) || !classes.has(referenceClass))
      throw new Error("Factor restoration classes must be unique and approved");
    seen.add(referenceClass);
    const expected = classes.get(referenceClass);
    const durationFactor = number(item.durationFactor, `${referenceClass} durationFactor`, 1, 10);
    const capacityFactor = number(item.capacityFactor, `${referenceClass} capacityFactor`, 1, 10);
    return {
      referenceClass,
      durationFactor,
      capacityFactor,
      matchesPrior:
        durationFactor === expected.durationFactor && capacityFactor === expected.capacityFactor,
      evidence: text(item.evidence, `${referenceClass} restoration evidence`, 1000),
    };
  });
}

function normalizeSnapshotClasses(raw, id, classes) {
  if (!Array.isArray(raw) || raw.length !== classes.size)
    throw new Error(`${id} must report every approved reference class exactly once`);
  const seen = new Set();
  return raw.map((item, index) => {
    const referenceClass = text(item.referenceClass, `${id} class ${index + 1} referenceClass`, 80);
    if (seen.has(referenceClass) || !classes.has(referenceClass))
      throw new Error(`${id} reference classes must be unique and approved`);
    seen.add(referenceClass);
    return {
      referenceClass,
      sampleSize: integer(item.sampleSize, `${id} ${referenceClass} sampleSize`, 1, 1_000_000),
      durationErrorRate: number(item.durationErrorRate, `${id} ${referenceClass} durationErrorRate`, 0, 10),
      capacityErrorRate: number(item.capacityErrorRate, `${id} ${referenceClass} capacityErrorRate`, 0, 10),
      incidents: integer(item.incidents, `${id} ${referenceClass} incidents`, 0, 1_000_000),
      evidence: text(item.evidence, `${id} ${referenceClass} evidence`, 1000),
    };
  });
}

function normalizeSnapshots(raw, executedAt, asOf, version, classes) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 20)
    throw new Error("Provide 2–20 recovery snapshots");
  const ids = new Set();
  let previous = executedAt;
  return raw.map((item, index) => {
    const id = text(item.id, `Snapshot ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Recovery snapshot IDs must be unique");
    ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`);
    if (observedAt <= previous || observedAt > asOf)
      throw new Error("Recovery snapshots must be chronological, after execution, and not after asOf");
    const gapHours = round((Date.parse(observedAt) - Date.parse(previous)) / HOUR);
    previous = observedAt;
    return {
      id,
      observedAt,
      gapHours,
      version: text(item.version, `${id} version`, 80),
      versionMatch: item.version === version,
      referenceClasses: normalizeSnapshotClasses(item.referenceClasses, id, classes),
      evidence: text(item.evidence, `${id} evidence`, 1000),
    };
  });
}

function summarizeClasses(snapshots, classes, policy) {
  return [...classes.keys()].map((referenceClass) => {
    const rows = snapshots.map((snapshot) =>
      snapshot.referenceClasses.find((item) => item.referenceClass === referenceClass));
    const sampleSize = rows.reduce((sum, row) => sum + row.sampleSize, 0);
    const weighted = (field) => round(
      rows.reduce((sum, row) => sum + row[field] * row.sampleSize, 0) / sampleSize,
    );
    const durationErrorRate = weighted("durationErrorRate");
    const capacityErrorRate = weighted("capacityErrorRate");
    return {
      referenceClass,
      sampleSize,
      durationErrorRate,
      capacityErrorRate,
      incidents: rows.reduce((sum, row) => sum + row.incidents, 0),
      sufficient: sampleSize >= policy.minimumSamplesPerClass,
      accurate:
        durationErrorRate <= policy.maximumDurationErrorRate &&
        capacityErrorRate <= policy.maximumCapacityErrorRate,
    };
  });
}

export function verifyRoadmapRecalibrationRecovery(recalibrationReport, rolloutReport, input = {}) {
  const recalibration = normalizeRecalibration(recalibrationReport);
  const rollout = normalizeRollout(rolloutReport, recalibration);
  const id = text(input.id, "verification id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < rollout.asOf) throw new Error("Verification asOf cannot precede Project 49");
  const policy = {
    minimumObservationHours: integer(input.minimumObservationHours, "minimumObservationHours", 1, 2160),
    maximumSnapshotGapHours: integer(input.maximumSnapshotGapHours, "maximumSnapshotGapHours", 1, 720),
    minimumSamplesPerClass: integer(input.minimumSamplesPerClass, "minimumSamplesPerClass", 2, 1_000_000),
    maximumDurationErrorRate: number(input.maximumDurationErrorRate, "maximumDurationErrorRate", 0, 2),
    maximumCapacityErrorRate: number(input.maximumCapacityErrorRate, "maximumCapacityErrorRate", 0, 2),
    maximumIncidents: integer(input.maximumIncidents, "maximumIncidents", 0, 10_000),
  };
  const execution = {
    rollbackId: text(input.execution?.rollbackId, "execution rollbackId", 120),
    authorizedAt: timestamp(input.execution?.authorizedAt, "execution authorizedAt"),
    executedAt: timestamp(input.execution?.executedAt, "execution executedAt"),
    fromVersion: text(input.execution?.fromVersion, "execution fromVersion", 80),
    toVersion: text(input.execution?.toVersion, "execution toVersion", 80),
    owner: text(input.execution?.owner, "execution owner", 120),
    recoveryHours: number(input.execution?.recoveryHours, "execution recoveryHours", 0, 168),
    evidence: text(input.execution?.evidence, "execution evidence", 1000),
  };
  if (execution.authorizedAt < rollout.reviewedAt || execution.executedAt < execution.authorizedAt)
    throw new Error("Rollback execution must follow the Project 49 authorization");
  if (execution.executedAt > asOf) throw new Error("Rollback execution cannot exceed asOf");
  const restorations = normalizeRestorations(input.factorRestorations, recalibration.classes);
  const snapshots = normalizeSnapshots(
    input.snapshots,
    execution.executedAt,
    asOf,
    recalibration.activeVersion,
    recalibration.classes,
  );
  const classes = summarizeClasses(snapshots, recalibration.classes, policy);
  const observationHours = round(
    (Date.parse(snapshots.at(-1).observedAt) - Date.parse(execution.executedAt)) / HOUR,
  );
  const incidents = classes.reduce((sum, item) => sum + item.incidents, 0);
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("Review cannot precede verification asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!['close', 'continue_monitoring', 'escalate'].includes(decision))
    throw new Error("Review decision is invalid");

  const checks = [
    check("authorized-rollback", true, `Project 49 rollback decision ${rollout.id} authorizes recovery.`),
    check(
      "execution-owner",
      execution.owner === rollout.rollback.owner,
      "Rollback execution retains the approved owner.",
    ),
    check(
      "recovery-window",
      execution.recoveryHours <= rollout.rollback.maximumRecoveryHours,
      `Recovery completes within ${rollout.rollback.maximumRecoveryHours} approved hour(s).`,
    ),
    check(
      "restored-version",
      execution.fromVersion === recalibration.proposedVersion &&
        execution.toVersion === recalibration.activeVersion &&
        execution.toVersion === rollout.rollback.targetVersion &&
        snapshots.every((snapshot) => snapshot.versionMatch),
      `Execution and every snapshot restore ${recalibration.activeVersion}.`,
    ),
    check(
      "restored-factors",
      restorations.every((item) => item.matchesPrior),
      "Every class restores the exact pre-recalibration factors.",
    ),
    check(
      "observation-window",
      observationHours >= policy.minimumObservationHours,
      `Recovery is observed for ${observationHours} hour(s).`,
    ),
    check(
      "snapshot-cadence",
      snapshots.every((snapshot) => snapshot.gapHours <= policy.maximumSnapshotGapHours),
      `Every snapshot gap is at most ${policy.maximumSnapshotGapHours} hour(s).`,
    ),
    check(
      "representative-sample",
      classes.every((item) => item.sufficient),
      `Every class has at least ${policy.minimumSamplesPerClass} observations.`,
    ),
    check(
      "restored-accuracy",
      classes.every((item) => item.accurate),
      "Every restored class remains within duration and capacity error limits.",
    ),
    check(
      "incident-guardrail",
      incidents <= policy.maximumIncidents,
      `${incidents} incident(s) observed against a limit of ${policy.maximumIncidents}.`,
    ),
    check(
      "evidence-complete",
      Boolean(execution.evidence) &&
        restorations.every((item) => item.evidence) &&
        snapshots.every((snapshot) =>
          snapshot.evidence && snapshot.referenceClasses.every((item) => item.evidence)),
      "Execution, restoration, snapshot, and class evidence are retained.",
    ),
  ];
  const allChecksPassed = checks.every((item) => item.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status: decision === "close"
      ? (allChecksPassed ? "verified_recovery" : "blocked_close")
      : "action_required",
    sourceRecalibrationId: recalibration.id,
    sourceRolloutId: rollout.id,
    recoveredVersion: recalibration.activeVersion,
    policy,
    execution,
    factorRestorations: restorations,
    snapshots,
    referenceClasses: classes,
    summary: {
      snapshots: snapshots.length,
      referenceClasses: classes.length,
      totalSamples: classes.reduce((sum, item) => sum + item.sampleSize, 0),
      observationHours,
      incidents,
      allChecksPassed,
    },
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic verification of authorized recalibration rollback execution, exact prior version and factor restoration, recovery timing, observation coverage, cadence, sample, accuracy, incident, and evidence gates; this verifier never changes versions, factors, estimates, exposure, schedules, assignments, rollback state, or product state",
  };
}

