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

function isoDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${name} must be an ISO date`);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value)
    throw new Error(`${name} must be a real ISO date`);
  return value;
}

const day = (value) => Math.floor(Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / DAY);
const round = (value) => Number(value.toFixed(4));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percentile = (values, rate) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(rate * sorted.length) - 1)];
};

function normalizeCase(entry, index, asOf, maximumEvidenceAgeDays) {
  const schedule = entry?.scheduleReport;
  const delivery = entry?.deliveryReport;
  if (schedule?.schemaVersion !== "1.0.0" || schedule.status !== "approved_schedule" || !Array.isArray(schedule.schedule) || !schedule.schedule.length || schedule.schedule.length > 8)
    throw new Error(`Case ${index + 1} requires an approved bounded Project 40 report`);
  if (delivery?.schemaVersion !== "1.0.0" || delivery.sourceScheduleId !== schedule.id || !Array.isArray(delivery.items))
    throw new Error(`Case ${index + 1} requires a matching Project 41 report`);
  const deliveryAsOf = timestamp(delivery.asOf, `Case ${index + 1} delivery asOf`);
  if (deliveryAsOf > asOf) throw new Error("Delivery evidence cannot follow calibration asOf");
  const ageDays = Math.floor((Date.parse(asOf) - Date.parse(deliveryAsOf)) / DAY);
  const scheduleMap = new Map();
  for (const item of schedule.schedule) {
    const id = text(item.portfolioItemId, "scheduled portfolio item id", 240);
    if (scheduleMap.has(id)) throw new Error("Project 40 item IDs must be unique");
    scheduleMap.set(id, item);
  }
  if (delivery.items.length !== scheduleMap.size)
    throw new Error("Project 41 must cover every Project 40 item exactly");
  if (!Array.isArray(entry.classifications) || entry.classifications.length !== scheduleMap.size)
    throw new Error("Provide exactly one reference-class classification per scheduled item");
  const classificationMap = new Map();
  for (const classification of entry.classifications) {
    const id = text(classification.portfolioItemId, "classification portfolio item id", 240);
    if (!scheduleMap.has(id) || classificationMap.has(id))
      throw new Error("Classifications contain unknown or duplicate item IDs");
    classificationMap.set(id, {
      referenceClass: text(classification.referenceClass, `${id} referenceClass`, 80),
      basis: text(classification.basis, `${id} classification basis`, 1000),
    });
  }
  const seen = new Set();
  const items = delivery.items.map((actual) => {
    const id = text(actual.portfolioItemId, "delivered portfolio item id", 240);
    if (!scheduleMap.has(id) || seen.has(id))
      throw new Error("Project 41 items contain unknown or duplicate IDs");
    seen.add(id);
    if (actual.status !== "completed" || !actual.actualStart || !actual.actualFinish)
      throw new Error("Calibration accepts completed delivery items only");
    const planned = scheduleMap.get(id);
    const actualStart = isoDate(actual.actualStart, `${id} actualStart`);
    const actualFinish = isoDate(actual.actualFinish, `${id} actualFinish`);
    const plannedStart = isoDate(planned.start, `${id} planned start`);
    const plannedFinish = isoDate(planned.finish, `${id} planned finish`);
    if (actualFinish < actualStart) throw new Error(`${id} actual dates are inconsistent`);
    const plannedElapsedDays = day(plannedFinish) - day(plannedStart) + 1;
    const actualElapsedDays = day(actualFinish) - day(actualStart) + 1;
    const plannedCapacityDays = integer(planned.durationDays, `${id} durationDays`, 1, 180) * integer(planned.capacity, `${id} capacity`, 1, 20);
    const actualCapacityDays = number(actual.actualCapacityDays, `${id} actualCapacityDays`, 0.1, 10_000);
    if (!Array.isArray(planned.evidenceIds) || !planned.evidenceIds.length || !text(actual.evidence, `${id} delivery evidence`, 1000))
      throw new Error(`${id} must preserve customer and delivery evidence`);
    const classification = classificationMap.get(id);
    return {
      caseId: text(delivery.id, `Case ${index + 1} delivery id`, 120),
      scheduleId: text(schedule.id, `Case ${index + 1} schedule id`, 120),
      portfolioItemId: id,
      title: text(planned.title, `${id} title`, 240),
      teamId: text(planned.teamId, `${id} teamId`, 80),
      ...classification,
      plannedElapsedDays,
      actualElapsedDays,
      durationRatio: round(actualElapsedDays / plannedElapsedDays),
      plannedCapacityDays,
      actualCapacityDays,
      capacityRatio: round(actualCapacityDays / plannedCapacityDays),
      finishVarianceDays: day(actualFinish) - day(plannedFinish),
      deadlineMet: actual.deadlineMet === true,
      evidenceIds: planned.evidenceIds,
      deliveryEvidence: actual.evidence,
      deliveryAsOf,
      ageDays,
      fresh: ageDays <= maximumEvidenceAgeDays,
    };
  });
  return { deliveryId: delivery.id, scheduleId: schedule.id, ageDays, items };
}

function buildReferenceClasses(items, minimumReferenceClassSize, percentileRate) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.referenceClass)) groups.set(item.referenceClass, []);
    groups.get(item.referenceClass).push(item);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([referenceClass, rows]) => {
    const durationRatios = rows.map((row) => row.durationRatio);
    const capacityRatios = rows.map((row) => row.capacityRatio);
    const sufficient = rows.length >= minimumReferenceClassSize;
    return {
      referenceClass,
      sampleSize: rows.length,
      sufficient,
      medianDurationRatio: round(median(durationRatios)),
      percentileDurationRatio: round(percentile(durationRatios, percentileRate)),
      medianCapacityRatio: round(median(capacityRatios)),
      percentileCapacityRatio: round(percentile(capacityRatios, percentileRate)),
      meanAbsoluteDurationError: round(rows.reduce((sum, row) => sum + Math.abs(row.actualElapsedDays - row.plannedElapsedDays) / row.plannedElapsedDays, 0) / rows.length),
      meanAbsoluteCapacityError: round(rows.reduce((sum, row) => sum + Math.abs(row.actualCapacityDays - row.plannedCapacityDays) / row.plannedCapacityDays, 0) / rows.length),
      onTimeRate: round(rows.filter((row) => row.deadlineMet).length / rows.length),
      recommendedDurationFactor: sufficient ? round(Math.max(1, percentile(durationRatios, percentileRate))) : null,
      recommendedCapacityFactor: sufficient ? round(Math.max(1, percentile(capacityRatios, percentileRate))) : null,
      sourceCaseIds: [...new Set(rows.map((row) => row.caseId))],
      sourcePortfolioItemIds: rows.map((row) => row.portfolioItemId),
    };
  });
}

export function calibrateRoadmapEstimates(runs, cases, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error("Provide an array of at most 50 product runs");
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 30) throw new Error("Provide 1–30 delivery cases");
  const id = text(input.id, "calibration id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const minimumReferenceClassSize = integer(input.minimumReferenceClassSize, "minimumReferenceClassSize", 2, 20);
  const percentileRate = number(input.percentileRate, "percentileRate", 0.5, 0.95);
  const maximumEvidenceAgeDays = integer(input.maximumEvidenceAgeDays, "maximumEvidenceAgeDays", 1, 1825);
  const normalized = cases.map((entry, index) => normalizeCase(entry, index, asOf, maximumEvidenceAgeDays));
  const deliveryIds = normalized.map((entry) => text(entry.deliveryId, "delivery case id", 120));
  if (new Set(deliveryIds).size !== deliveryIds.length) throw new Error("Delivery case IDs must be unique");
  const scheduleIds = normalized.map((entry) => text(entry.scheduleId, "schedule case id", 120));
  if (new Set(scheduleIds).size !== scheduleIds.length) throw new Error("Schedule case IDs must be unique");
  const items = normalized.flatMap((entry) => entry.items);
  if (items.length > 200) throw new Error("Calibration supports at most 200 completed items");
  const referenceClasses = buildReferenceClasses(items, minimumReferenceClassSize, percentileRate);
  const checks = [
    { id: "completed-outcomes", passed: items.every((item) => item.actualElapsedDays > 0 && item.actualCapacityDays > 0), detail: `${items.length} completed item(s) included.` },
    { id: "evidence-freshness", passed: items.every((item) => item.fresh), detail: `${items.filter((item) => !item.fresh).length} item(s) exceed the evidence-age policy.` },
    { id: "reference-class-sufficiency", passed: referenceClasses.every((group) => group.sufficient), detail: `${referenceClasses.filter((group) => group.sufficient).length} of ${referenceClasses.length} class(es) meet the minimum sample size.` },
    { id: "evidence-lineage", passed: items.every((item) => item.evidenceIds.length && item.deliveryEvidence && item.basis), detail: "Every observation retains customer, delivery, and classification evidence." },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede calibration asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["adopt", "revise", "defer"].includes(decision)) throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    status: decision === "adopt" ? (allPassed ? "adopted_calibration" : "blocked_adoption") : "action_required",
    policy: { minimumReferenceClassSize, percentileRate, maximumEvidenceAgeDays },
    summary: {
      cases: normalized.length,
      completedItems: items.length,
      referenceClasses: referenceClasses.length,
      sufficientClasses: referenceClasses.filter((group) => group.sufficient).length,
      staleItems: items.filter((item) => !item.fresh).length,
      overallOnTimeRate: round(items.filter((item) => item.deadlineMet).length / items.length),
    },
    referenceClasses,
    observations: items,
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method: "deterministic reference-class calibration from completed Project 40–41 cases using nearest-rank percentiles; factors are transparent historical cross-checks, not forecasts or probabilities, and are never applied to future estimates automatically",
  };
}
