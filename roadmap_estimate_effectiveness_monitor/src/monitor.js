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
const errorRate = (estimate, actual) => round(Math.abs(estimate - actual) / actual);
const mean = (values) => round(values.reduce((sum, value) => sum + value, 0) / values.length);

function normalizeSchedule(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "approved_schedule" ||
    !Array.isArray(report.schedule) ||
    !report.schedule.length ||
    report.schedule.length > 8
  ) throw new Error("Project 46 requires an approved bounded Project 40 report");
  const items = new Map();
  for (const [index, raw] of report.schedule.entries()) {
    const id = text(raw.portfolioItemId, `Schedule item ${index + 1} portfolioItemId`, 240);
    if (items.has(id)) throw new Error("Project 40 item IDs must be unique");
    if (!Array.isArray(raw.evidenceIds) || !raw.evidenceIds.length)
      throw new Error(`${id} must retain customer evidence`);
    items.set(id, {
      portfolioItemId: id,
      title: text(raw.title, `${id} title`, 240),
      durationDays: integer(raw.durationDays, `${id} durationDays`, 1, 180),
      capacityDays: integer(raw.durationDays, `${id} durationDays`, 1, 180) *
        integer(raw.capacity, `${id} capacity`, 1, 20),
      evidenceIds: raw.evidenceIds.map((value, evidenceIndex) =>
        text(value, `${id} evidence ${evidenceIndex + 1}`, 240)),
    });
  }
  return {
    id: text(report.id, "Project 40 id", 120),
    asOf: timestamp(report.asOf, "Project 40 asOf"),
    items,
  };
}

function normalizeDelivery(report, schedule) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.sourceScheduleId !== schedule.id ||
    !Array.isArray(report.items) ||
    report.items.length !== schedule.items.size
  ) throw new Error("Project 46 requires the matching Project 41 delivery report");
  const items = new Map();
  for (const [index, raw] of report.items.entries()) {
    const id = text(raw.portfolioItemId, `Delivery item ${index + 1} portfolioItemId`, 240);
    if (!schedule.items.has(id) || items.has(id))
      throw new Error("Project 41 items must exactly cover Project 40 without duplicates");
    const status = text(raw.status, `${id} delivery status`, 20);
    const actualStart = timestamp(raw.actualStart, `${id} actualStart`);
    const actualFinish = timestamp(raw.actualFinish, `${id} actualFinish`);
    if (actualFinish < actualStart) throw new Error(`${id} actualFinish cannot precede actualStart`);
    items.set(id, {
      status,
      actualStart,
      actualFinish,
      actualCapacityDays: number(raw.actualCapacityDays, `${id} actualCapacityDays`, 0.1, 100_000),
    });
  }
  return {
    id: text(report.id, "Project 41 id", 120),
    asOf: timestamp(report.asOf, "Project 41 asOf"),
    items,
  };
}

function normalizeAdoption(report, schedule) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    report.status !== "approved_estimate_basis" ||
    report.sourceScheduleId !== schedule.id ||
    !Array.isArray(report.applications) ||
    report.applications.length !== schedule.items.size
  ) throw new Error("Project 46 requires the matching approved Project 45 estimate basis");
  const items = new Map();
  for (const [index, raw] of report.applications.entries()) {
    const id = text(raw.portfolioItemId, `Application ${index + 1} portfolioItemId`, 240);
    if (!schedule.items.has(id) || items.has(id))
      throw new Error("Project 45 applications must exactly cover Project 40 without duplicates");
    const scheduled = schedule.items.get(id);
    const scheduledDurationDays = number(raw.scheduledDurationDays, `${id} scheduledDurationDays`, 0.1, 365);
    const scheduledCapacityDays = number(raw.scheduledCapacityDays, `${id} scheduledCapacityDays`, 0.1, 100_000);
    if (scheduledDurationDays !== scheduled.durationDays || scheduledCapacityDays !== scheduled.capacityDays)
      throw new Error(`${id} Project 45 estimates must reconcile to Project 40`);
    if (!Array.isArray(raw.evidenceIds) || !raw.evidenceIds.length)
      throw new Error(`${id} Project 45 evidence lineage is required`);
    items.set(id, {
      referenceClass: text(raw.referenceClass, `${id} referenceClass`, 80),
      baseDurationDays: number(raw.baseDurationDays, `${id} baseDurationDays`, 0.1, 365),
      baseCapacityDays: number(raw.baseCapacityDays, `${id} baseCapacityDays`, 0.1, 100_000),
      scheduledDurationDays,
      scheduledCapacityDays,
      exception: raw.exception ? {
        reviewer: text(raw.exception.reviewer, `${id} exception reviewer`, 120),
        rationale: text(raw.exception.rationale, `${id} exception rationale`, 1000),
      } : null,
      evidenceIds: raw.evidenceIds.map((value, evidenceIndex) =>
        text(value, `${id} adoption evidence ${evidenceIndex + 1}`, 240)),
    });
  }
  return {
    id: text(report.id, "Project 45 id", 120),
    asOf: timestamp(report.asOf, "Project 45 asOf"),
    items,
  };
}

function normalizeOutcomes(raw, schedule) {
  if (!Array.isArray(raw) || raw.length !== schedule.items.size)
    throw new Error("Provide exactly one reviewed outcome per Project 40 item");
  const seen = new Set();
  return raw.map((entry, index) => {
    const id = text(entry.portfolioItemId, `Outcome ${index + 1} portfolioItemId`, 240);
    if (!schedule.items.has(id) || seen.has(id))
      throw new Error("Outcomes contain unknown or duplicate Project 40 item IDs");
    seen.add(id);
    return {
      portfolioItemId: id,
      actualDurationDays: number(entry.actualDurationDays, `${id} actualDurationDays`, 0.1, 365),
      evidence: text(entry.evidence, `${id} outcome evidence`, 1000),
    };
  });
}

export function monitorRoadmapEstimateEffectiveness(
  runs,
  scheduleReport,
  deliveryReport,
  adoptionReport,
  input = {},
) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const id = text(input.id, "monitor id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const schedule = normalizeSchedule(scheduleReport);
  const delivery = normalizeDelivery(deliveryReport, schedule);
  const adoption = normalizeAdoption(adoptionReport, schedule);
  if (adoption.asOf < schedule.asOf)
    throw new Error("Project 45 adoption cannot precede Project 40 approval");
  if (delivery.asOf < adoption.asOf)
    throw new Error("Project 41 delivery evidence must follow Project 45 adoption");
  if (asOf < delivery.asOf) throw new Error("Monitor asOf cannot precede Project 41 delivery evidence");

  const maximumDurationErrorRate = number(
    input.maximumDurationErrorRate,
    "maximumDurationErrorRate",
    0,
    2,
  );
  const maximumCapacityErrorRate = number(
    input.maximumCapacityErrorRate,
    "maximumCapacityErrorRate",
    0,
    2,
  );
  const minimumErrorReductionRate = number(
    input.minimumErrorReductionRate,
    "minimumErrorReductionRate",
    0,
    1,
  );
  const outcomes = normalizeOutcomes(input.outcomes, schedule);
  const items = outcomes.map((outcome) => {
    const scheduled = schedule.items.get(outcome.portfolioItemId);
    const delivered = delivery.items.get(outcome.portfolioItemId);
    const adopted = adoption.items.get(outcome.portfolioItemId);
    const baseDurationErrorRate = errorRate(adopted.baseDurationDays, outcome.actualDurationDays);
    const calibratedDurationErrorRate = errorRate(adopted.scheduledDurationDays, outcome.actualDurationDays);
    const baseCapacityErrorRate = errorRate(adopted.baseCapacityDays, delivered.actualCapacityDays);
    const calibratedCapacityErrorRate = errorRate(adopted.scheduledCapacityDays, delivered.actualCapacityDays);
    const durationErrorReductionRate = round(baseDurationErrorRate - calibratedDurationErrorRate);
    const capacityErrorReductionRate = round(baseCapacityErrorRate - calibratedCapacityErrorRate);
    const completed = delivered.status === "completed";
    const withinTolerance =
      calibratedDurationErrorRate <= maximumDurationErrorRate &&
      calibratedCapacityErrorRate <= maximumCapacityErrorRate;
    const improved =
      durationErrorReductionRate >= minimumErrorReductionRate &&
      capacityErrorReductionRate >= minimumErrorReductionRate;
    return {
      portfolioItemId: outcome.portfolioItemId,
      title: scheduled.title,
      referenceClass: adopted.referenceClass,
      completed,
      baseDurationDays: adopted.baseDurationDays,
      calibratedDurationDays: adopted.scheduledDurationDays,
      actualDurationDays: outcome.actualDurationDays,
      baseDurationErrorRate,
      calibratedDurationErrorRate,
      durationErrorReductionRate,
      baseCapacityDays: adopted.baseCapacityDays,
      calibratedCapacityDays: adopted.scheduledCapacityDays,
      actualCapacityDays: delivered.actualCapacityDays,
      baseCapacityErrorRate,
      calibratedCapacityErrorRate,
      capacityErrorReductionRate,
      withinTolerance,
      improved,
      exception: adopted.exception,
      exceptionOutcomeAcceptable: adopted.exception ? completed && withinTolerance : null,
      customerEvidenceIds: scheduled.evidenceIds,
      adoptionEvidenceIds: adopted.evidenceIds,
      outcomeEvidence: outcome.evidence,
    };
  });

  const exceptionItems = items.filter((item) => item.exception);
  const checks = [
    {
      id: "exact-lineage",
      passed: items.length === schedule.items.size,
      detail: `${items.length} of ${schedule.items.size} scheduled item(s) retain Project 40, 41, and 45 lineage.`,
    },
    {
      id: "completed-outcomes",
      passed: items.every((item) => item.completed),
      detail: `${items.filter((item) => item.completed).length} of ${items.length} item(s) have completed delivery evidence.`,
    },
    {
      id: "accuracy-thresholds",
      passed: items.every((item) => item.withinTolerance),
      detail: `${items.filter((item) => item.withinTolerance).length} of ${items.length} calibrated estimate(s) are within declared duration and capacity tolerances.`,
    },
    {
      id: "calibration-improvement",
      passed: items.every((item) => item.improved),
      detail: `${items.filter((item) => item.improved).length} of ${items.length} item(s) meet the minimum error-reduction policy in both dimensions.`,
    },
    {
      id: "exception-outcomes",
      passed: exceptionItems.every((item) => item.exceptionOutcomeAcceptable),
      detail: `${exceptionItems.filter((item) => item.exceptionOutcomeAcceptable).length} of ${exceptionItems.length} exception outcome(s) are within tolerance.`,
    },
    {
      id: "evidence-lineage",
      passed: items.every((item) =>
        item.customerEvidenceIds.length && item.adoptionEvidenceIds.length && item.outcomeEvidence),
      detail: "Every result retains customer, adoption, and reviewed outcome evidence.",
    },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede monitor asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["retain", "adjust", "collect_more"].includes(decision))
    throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);

  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourceScheduleId: schedule.id,
    sourceDeliveryId: delivery.id,
    sourceAdoptionId: adoption.id,
    status: decision === "retain"
      ? (allPassed ? "verified_effectiveness" : "blocked_retention")
      : "action_required",
    policy: {
      maximumDurationErrorRate,
      maximumCapacityErrorRate,
      minimumErrorReductionRate,
    },
    summary: {
      items: items.length,
      completedItems: items.filter((item) => item.completed).length,
      accurateItems: items.filter((item) => item.withinTolerance).length,
      improvedItems: items.filter((item) => item.improved).length,
      exceptionItems: exceptionItems.length,
      acceptableExceptionOutcomes: exceptionItems.filter((item) => item.exceptionOutcomeAcceptable).length,
      meanBaseDurationErrorRate: mean(items.map((item) => item.baseDurationErrorRate)),
      meanCalibratedDurationErrorRate: mean(items.map((item) => item.calibratedDurationErrorRate)),
      meanDurationErrorReductionRate: mean(items.map((item) => item.durationErrorReductionRate)),
      meanBaseCapacityErrorRate: mean(items.map((item) => item.baseCapacityErrorRate)),
      meanCalibratedCapacityErrorRate: mean(items.map((item) => item.calibratedCapacityErrorRate)),
      meanCapacityErrorReductionRate: mean(items.map((item) => item.capacityErrorReductionRate)),
    },
    checks,
    items,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic retrospective comparison of Project 45 base and calibrated duration/capacity estimates against completed Project 41 outcomes and reviewed actual workdays; error reduction is descriptive, exception outcomes do not prove exception causality, and the monitor never changes factors, estimates, schedules, or product state",
  };
}
