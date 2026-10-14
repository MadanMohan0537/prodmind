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

function normalizeSchedule(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "approved_schedule" ||
    !Array.isArray(report.schedule) ||
    !report.schedule.length ||
    report.schedule.length > 8
  ) throw new Error("Project 45 requires an approved bounded Project 40 report");
  const asOf = timestamp(report.asOf, "Project 40 asOf");
  const seen = new Set();
  const items = report.schedule.map((item, index) => {
    const id = text(item.portfolioItemId, `Schedule item ${index + 1} portfolioItemId`, 240);
    if (seen.has(id)) throw new Error("Project 40 item IDs must be unique");
    seen.add(id);
    if (!Array.isArray(item.evidenceIds) || !item.evidenceIds.length)
      throw new Error(`${id} must retain customer evidence`);
    return {
      portfolioItemId: id,
      title: text(item.title, `${id} title`, 240),
      durationDays: integer(item.durationDays, `${id} durationDays`, 1, 180),
      capacity: integer(item.capacity, `${id} capacity`, 1, 20),
      estimateBasis: text(item.estimateBasis, `${id} Project 40 estimateBasis`, 1000),
      evidenceIds: item.evidenceIds.map((value, evidenceIndex) =>
        text(value, `${id} evidence ${evidenceIndex + 1}`, 240)),
    };
  });
  return {
    id: text(report.id, "Project 40 id", 120),
    asOf,
    reviewer: text(report.review?.reviewer, "Project 40 reviewer", 120),
    items,
  };
}

function normalizeCalibration(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "adopted_calibration" ||
    !Array.isArray(report.referenceClasses) ||
    !report.referenceClasses.length ||
    report.referenceClasses.length > 100
  ) throw new Error("Project 45 requires an adopted Project 44 calibration");
  const asOf = timestamp(report.asOf, "Project 44 asOf");
  const classes = new Map();
  for (const entry of report.referenceClasses) {
    const id = text(entry.referenceClass, "referenceClass", 80);
    if (classes.has(id)) throw new Error("Project 44 reference classes must be unique");
    classes.set(id, {
      referenceClass: id,
      sufficient: entry.sufficient === true,
      sampleSize: integer(entry.sampleSize, `${id} sampleSize`, 1, 200),
      recommendedDurationFactor: entry.recommendedDurationFactor === null
        ? null
        : number(entry.recommendedDurationFactor, `${id} recommendedDurationFactor`, 0.1, 10),
      recommendedCapacityFactor: entry.recommendedCapacityFactor === null
        ? null
        : number(entry.recommendedCapacityFactor, `${id} recommendedCapacityFactor`, 0.1, 10),
    });
  }
  return {
    id: text(report.id, "Project 44 id", 120),
    asOf,
    reviewer: text(report.review?.reviewer, "Project 44 reviewer", 120),
    classes,
  };
}

function normalizeException(raw, itemId, schedule, calibration, required) {
  if (!raw) return null;
  if (!required) throw new Error(`${itemId} has an unnecessary calibration exception`);
  const reviewedAt = timestamp(raw.reviewedAt, `${itemId} exception reviewedAt`);
  if (reviewedAt > schedule.asOf)
    throw new Error(`${itemId} exception must be approved no later than Project 40 asOf`);
  const reviewer = text(raw.reviewer, `${itemId} exception reviewer`, 120);
  if (reviewer === schedule.reviewer || reviewer === calibration.reviewer)
    throw new Error(`${itemId} exception reviewer must be independent`);
  const decision = text(raw.decision, `${itemId} exception decision`, 20);
  if (decision !== "approve") throw new Error(`${itemId} exception decision must be approve`);
  return {
    reviewer,
    decision,
    rationale: text(raw.rationale, `${itemId} exception rationale`, 1000),
    evidence: text(raw.evidence, `${itemId} exception evidence`, 1000),
    reviewedAt,
  };
}

function normalizeApplications(raw, schedule, calibration, roundingToleranceDays, capacityToleranceRate) {
  if (!Array.isArray(raw) || raw.length !== schedule.items.length)
    throw new Error("Provide exactly one estimate application per Project 40 item");
  const scheduled = new Map(schedule.items.map((item) => [item.portfolioItemId, item]));
  const seen = new Set();
  return raw.map((entry, index) => {
    const portfolioItemId = text(entry.portfolioItemId, `Application ${index + 1} portfolioItemId`, 240);
    const item = scheduled.get(portfolioItemId);
    if (!item || seen.has(portfolioItemId))
      throw new Error("Estimate applications contain unknown or duplicate Project 40 item IDs");
    seen.add(portfolioItemId);
    const referenceClass = text(entry.referenceClass, `${portfolioItemId} referenceClass`, 80);
    const reference = calibration.classes.get(referenceClass);
    const baseDurationDays = number(entry.baseDurationDays, `${portfolioItemId} baseDurationDays`, 0.1, 180);
    const baseCapacityDays = number(entry.baseCapacityDays, `${portfolioItemId} baseCapacityDays`, 0.1, 10_000);
    const appliedDurationFactor = number(entry.appliedDurationFactor, `${portfolioItemId} appliedDurationFactor`, 0.1, 10);
    const appliedCapacityFactor = number(entry.appliedCapacityFactor, `${portfolioItemId} appliedCapacityFactor`, 0.1, 10);
    const recommendedDurationFactor = reference?.recommendedDurationFactor ?? null;
    const recommendedCapacityFactor = reference?.recommendedCapacityFactor ?? null;
    const classUsable = Boolean(reference?.sufficient && recommendedDurationFactor !== null && recommendedCapacityFactor !== null);
    const durationMeetsRecommendation = classUsable && appliedDurationFactor >= recommendedDurationFactor;
    const capacityMeetsRecommendation = classUsable && appliedCapacityFactor >= recommendedCapacityFactor;
    const exceptionRequired = classUsable && (!durationMeetsRecommendation || !capacityMeetsRecommendation);
    const exception = normalizeException(entry.exception, portfolioItemId, schedule, calibration, exceptionRequired);
    const expectedDurationDays = Math.ceil(baseDurationDays * appliedDurationFactor);
    const expectedCapacityDays = round(baseCapacityDays * appliedCapacityFactor);
    const scheduledCapacityDays = item.durationDays * item.capacity;
    const durationVarianceDays = item.durationDays - expectedDurationDays;
    const capacityVarianceRate = round(
      Math.abs(scheduledCapacityDays - expectedCapacityDays) / expectedCapacityDays,
    );
    return {
      portfolioItemId,
      title: item.title,
      referenceClass,
      classUsable,
      sampleSize: reference?.sampleSize ?? null,
      baseDurationDays,
      baseCapacityDays,
      recommendedDurationFactor,
      recommendedCapacityFactor,
      appliedDurationFactor,
      appliedCapacityFactor,
      expectedDurationDays,
      expectedCapacityDays,
      scheduledDurationDays: item.durationDays,
      scheduledCapacityDays,
      durationVarianceDays,
      capacityVarianceRate,
      arithmeticReconciled:
        Math.abs(durationVarianceDays) <= roundingToleranceDays &&
        capacityVarianceRate <= capacityToleranceRate,
      factorControlPassed:
        classUsable &&
        ((durationMeetsRecommendation && capacityMeetsRecommendation) || Boolean(exception)),
      exception,
      estimateBasis: text(entry.estimateBasis, `${portfolioItemId} estimateBasis`, 1000),
      evidence: text(entry.evidence, `${portfolioItemId} evidence`, 1000),
      evidenceIds: item.evidenceIds,
      project40EstimateBasis: item.estimateBasis,
    };
  });
}

export function controlRoadmapEstimateAdoption(runs, scheduleReport, calibrationReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const id = text(input.id, "control id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const schedule = normalizeSchedule(scheduleReport);
  const calibration = normalizeCalibration(calibrationReport);
  if (calibration.asOf > schedule.asOf)
    throw new Error("Project 44 calibration must exist before Project 40 approval");
  if (asOf < schedule.asOf) throw new Error("Control asOf cannot precede Project 40 asOf");
  const maximumCalibrationAgeDays = integer(
    input.maximumCalibrationAgeDays,
    "maximumCalibrationAgeDays",
    1,
    730,
  );
  const roundingToleranceDays = integer(input.roundingToleranceDays, "roundingToleranceDays", 0, 5);
  const capacityToleranceRate = number(input.capacityToleranceRate, "capacityToleranceRate", 0, 0.2);
  const calibrationAgeDays = Math.floor((Date.parse(schedule.asOf) - Date.parse(calibration.asOf)) / DAY);
  const applications = normalizeApplications(
    input.applications,
    schedule,
    calibration,
    roundingToleranceDays,
    capacityToleranceRate,
  );
  const checks = [
    {
      id: "adopted-calibration",
      passed: true,
      detail: `Project 44 calibration ${calibration.id} is adopted and predates Project 40 approval.`,
    },
    {
      id: "calibration-freshness",
      passed: calibrationAgeDays <= maximumCalibrationAgeDays,
      detail: `Calibration is ${calibrationAgeDays} day(s) old; policy allows ${maximumCalibrationAgeDays}.`,
    },
    {
      id: "exact-application-coverage",
      passed: applications.length === schedule.items.length,
      detail: `${applications.length} of ${schedule.items.length} scheduled item(s) have one application.`,
    },
    {
      id: "reference-class-coverage",
      passed: applications.every((entry) => entry.classUsable),
      detail: `${applications.filter((entry) => entry.classUsable).length} of ${applications.length} item(s) use a sufficiently sampled class.`,
    },
    {
      id: "arithmetic-reconciliation",
      passed: applications.every((entry) => entry.arithmeticReconciled),
      detail: `${applications.filter((entry) => entry.arithmeticReconciled).length} of ${applications.length} item(s) reconcile to the approved schedule within policy tolerances.`,
    },
    {
      id: "factor-or-exception-control",
      passed: applications.every((entry) => entry.factorControlPassed),
      detail: `${applications.filter((entry) => entry.exception).length} item(s) use a prior independently reviewed exception.`,
    },
    {
      id: "evidence-lineage",
      passed: applications.every((entry) => entry.evidenceIds.length && entry.estimateBasis && entry.evidence),
      detail: "Every application retains customer evidence and its estimate basis.",
    },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede control asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["approve", "revise", "defer"].includes(decision))
    throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourceScheduleId: schedule.id,
    sourceCalibrationId: calibration.id,
    status: decision === "approve"
      ? (allPassed ? "approved_estimate_basis" : "blocked_approval")
      : "action_required",
    policy: { maximumCalibrationAgeDays, roundingToleranceDays, capacityToleranceRate },
    summary: {
      scheduledItems: schedule.items.length,
      compliantItems: applications.filter((entry) => entry.factorControlPassed && entry.arithmeticReconciled).length,
      exceptionItems: applications.filter((entry) => entry.exception).length,
      unusableClasses: applications.filter((entry) => !entry.classUsable).length,
      unreconciledItems: applications.filter((entry) => !entry.arithmeticReconciled).length,
      calibrationAgeDays,
    },
    applications,
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic reconciliation of each approved Project 40 estimate against a previously adopted Project 44 reference-class factor or a prior independently reviewed exception; it never changes estimates, predicts delivery, ranks people, or treats historical factors as probabilities",
  };
}
