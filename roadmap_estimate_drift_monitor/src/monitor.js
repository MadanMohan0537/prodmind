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
const average = (values) => values.length
  ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : null;

function evidenceIds(raw, name) {
  if (!Array.isArray(raw) || !raw.length) throw new Error(`${name} must not be empty`);
  return raw.map((value, index) => text(value, `${name} ${index + 1}`, 240));
}

function normalizeReport(report, index) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    !["verified_effectiveness", "blocked_retention", "action_required"].includes(report.status) ||
    !Array.isArray(report.items) ||
    !report.items.length ||
    report.items.length > 8
  ) throw new Error(`Assessment ${index + 1} must be a bounded Project 46 report`);
  const seen = new Set();
  const items = report.items.map((raw, itemIndex) => {
    const portfolioItemId = text(
      raw.portfolioItemId,
      `Assessment ${index + 1} item ${itemIndex + 1} portfolioItemId`,
      240,
    );
    if (seen.has(portfolioItemId)) throw new Error("Project 46 item IDs must be unique within a report");
    seen.add(portfolioItemId);
    return {
      portfolioItemId,
      referenceClass: text(raw.referenceClass, `${portfolioItemId} referenceClass`, 80),
      calibratedDurationErrorRate: number(
        raw.calibratedDurationErrorRate,
        `${portfolioItemId} calibratedDurationErrorRate`,
        0,
        2,
      ),
      calibratedCapacityErrorRate: number(
        raw.calibratedCapacityErrorRate,
        `${portfolioItemId} calibratedCapacityErrorRate`,
        0,
        2,
      ),
      durationErrorReductionRate: number(
        raw.durationErrorReductionRate,
        `${portfolioItemId} durationErrorReductionRate`,
        -2,
        2,
      ),
      capacityErrorReductionRate: number(
        raw.capacityErrorReductionRate,
        `${portfolioItemId} capacityErrorReductionRate`,
        -2,
        2,
      ),
      exception: Boolean(raw.exception),
      customerEvidenceIds: evidenceIds(raw.customerEvidenceIds, `${portfolioItemId} customerEvidenceIds`),
      adoptionEvidenceIds: evidenceIds(raw.adoptionEvidenceIds, `${portfolioItemId} adoptionEvidenceIds`),
      outcomeEvidence: text(raw.outcomeEvidence, `${portfolioItemId} outcomeEvidence`, 1000),
    };
  });
  return {
    id: text(report.id, `Assessment ${index + 1} id`, 120),
    asOf: timestamp(report.asOf, `Assessment ${index + 1} asOf`),
    status: report.status,
    sourceScheduleId: text(report.sourceScheduleId, `Assessment ${index + 1} sourceScheduleId`, 120),
    sourceDeliveryId: text(report.sourceDeliveryId, `Assessment ${index + 1} sourceDeliveryId`, 120),
    sourceAdoptionId: text(report.sourceAdoptionId, `Assessment ${index + 1} sourceAdoptionId`, 120),
    items,
  };
}

function normalizeReports(raw) {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 50)
    throw new Error("Provide 3–50 chronological Project 46 reports");
  const reports = raw.map(normalizeReport);
  const ids = new Set();
  for (let index = 0; index < reports.length; index++) {
    if (ids.has(reports[index].id)) throw new Error("Project 46 report IDs must be unique");
    ids.add(reports[index].id);
    if (index && reports[index].asOf <= reports[index - 1].asOf)
      throw new Error("Project 46 reports must be strictly chronological");
  }
  return reports;
}

function groupItems(reports) {
  const groups = new Map();
  for (const report of reports) {
    for (const item of report.items) {
      const values = groups.get(item.referenceClass) ?? [];
      values.push({ ...item, reportId: report.id, reportAsOf: report.asOf });
      groups.set(item.referenceClass, values);
    }
  }
  return groups;
}

export function monitorRoadmapEstimateDrift(runs, project46Reports, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const id = text(input.id, "monitor id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const reports = normalizeReports(project46Reports);
  const latest = reports.at(-1);
  if (asOf < latest.asOf) throw new Error("Monitor asOf cannot precede the latest Project 46 report");

  const baselineReportCount = integer(input.baselineReportCount, "baselineReportCount", 1, 20);
  const recentReportCount = integer(input.recentReportCount, "recentReportCount", 1, 20);
  if (baselineReportCount + recentReportCount > reports.length)
    throw new Error("Baseline and recent windows must not overlap");
  const minimumItemsPerClass = integer(input.minimumItemsPerClass, "minimumItemsPerClass", 1, 100);
  const maximumAssessmentGapDays = integer(input.maximumAssessmentGapDays, "maximumAssessmentGapDays", 1, 365);
  const maximumReportAgeDays = integer(input.maximumReportAgeDays, "maximumReportAgeDays", 0, 730);
  const maximumDurationErrorRate = number(input.maximumDurationErrorRate, "maximumDurationErrorRate", 0, 2);
  const maximumCapacityErrorRate = number(input.maximumCapacityErrorRate, "maximumCapacityErrorRate", 0, 2);
  const maximumErrorIncreaseRate = number(input.maximumErrorIncreaseRate, "maximumErrorIncreaseRate", 0, 2);
  const minimumErrorReductionRate = number(input.minimumErrorReductionRate, "minimumErrorReductionRate", 0, 1);
  const minimumClassCoverageRate = number(input.minimumClassCoverageRate, "minimumClassCoverageRate", 0, 1);

  const baselineReports = reports.slice(0, baselineReportCount);
  const recentReports = reports.slice(-recentReportCount);
  const baselineGroups = groupItems(baselineReports);
  const recentGroups = groupItems(recentReports);
  const classNames = [...new Set([...baselineGroups.keys(), ...recentGroups.keys()])].sort();
  const referenceClasses = classNames.map((referenceClass) => {
    const baseline = baselineGroups.get(referenceClass) ?? [];
    const recent = recentGroups.get(referenceClass) ?? [];
    const evaluable = baseline.length >= minimumItemsPerClass && recent.length >= minimumItemsPerClass;
    const baselineDurationErrorRate = average(baseline.map((item) => item.calibratedDurationErrorRate));
    const recentDurationErrorRate = average(recent.map((item) => item.calibratedDurationErrorRate));
    const baselineCapacityErrorRate = average(baseline.map((item) => item.calibratedCapacityErrorRate));
    const recentCapacityErrorRate = average(recent.map((item) => item.calibratedCapacityErrorRate));
    const durationErrorIncreaseRate = evaluable
      ? round(recentDurationErrorRate - baselineDurationErrorRate)
      : null;
    const capacityErrorIncreaseRate = evaluable
      ? round(recentCapacityErrorRate - baselineCapacityErrorRate)
      : null;
    const recentDurationErrorReductionRate = average(recent.map((item) => item.durationErrorReductionRate));
    const recentCapacityErrorReductionRate = average(recent.map((item) => item.capacityErrorReductionRate));
    const durationStable = Boolean(
      evaluable &&
      recentDurationErrorRate <= maximumDurationErrorRate &&
      durationErrorIncreaseRate <= maximumErrorIncreaseRate,
    );
    const capacityStable = Boolean(
      evaluable &&
      recentCapacityErrorRate <= maximumCapacityErrorRate &&
      capacityErrorIncreaseRate <= maximumErrorIncreaseRate,
    );
    const improvementRetained = Boolean(
      evaluable &&
      recentDurationErrorReductionRate >= minimumErrorReductionRate &&
      recentCapacityErrorReductionRate >= minimumErrorReductionRate,
    );
    return {
      referenceClass,
      evaluable,
      baselineSamples: baseline.length,
      recentSamples: recent.length,
      baselineDurationErrorRate,
      recentDurationErrorRate,
      durationErrorIncreaseRate,
      baselineCapacityErrorRate,
      recentCapacityErrorRate,
      capacityErrorIncreaseRate,
      recentDurationErrorReductionRate,
      recentCapacityErrorReductionRate,
      durationStable,
      capacityStable,
      improvementRetained,
      stable: durationStable && capacityStable && improvementRetained,
      exceptionItems: recent.filter((item) => item.exception).length,
      sourceReportIds: [...new Set([...baseline, ...recent].map((item) => item.reportId))],
    };
  });

  const assessmentGaps = reports.slice(1).map((report, index) => ({
    fromReportId: reports[index].id,
    toReportId: report.id,
    gapDays: Math.floor((Date.parse(report.asOf) - Date.parse(reports[index].asOf)) / DAY),
  }));
  const maximumObservedGapDays = Math.max(0, ...assessmentGaps.map((gap) => gap.gapDays));
  const latestReportAgeDays = Math.floor((Date.parse(asOf) - Date.parse(latest.asOf)) / DAY);
  const evaluableClasses = referenceClasses.filter((entry) => entry.evaluable);
  const classCoverageRate = round(evaluableClasses.length / referenceClasses.length);
  const lineageComplete = reports.every((report) =>
    report.sourceScheduleId && report.sourceDeliveryId && report.sourceAdoptionId &&
    report.items.every((item) =>
      item.customerEvidenceIds.length && item.adoptionEvidenceIds.length && item.outcomeEvidence));
  const checks = [
    {
      id: "sufficient-history",
      passed: baselineReports.length === baselineReportCount && recentReports.length === recentReportCount,
      detail: `${baselineReports.length} baseline and ${recentReports.length} recent Project 46 report(s) are compared without overlap.`,
    },
    {
      id: "assessment-cadence",
      passed: maximumObservedGapDays <= maximumAssessmentGapDays && latestReportAgeDays <= maximumReportAgeDays,
      detail: `Maximum gap is ${maximumObservedGapDays} day(s); latest report age is ${latestReportAgeDays} day(s).`,
    },
    {
      id: "reference-class-coverage",
      passed: classCoverageRate >= minimumClassCoverageRate,
      detail: `${evaluableClasses.length} of ${referenceClasses.length} class(es) meet sample policy in both windows.`,
    },
    {
      id: "duration-stability",
      passed: evaluableClasses.length > 0 && evaluableClasses.every((entry) => entry.durationStable),
      detail: `${evaluableClasses.filter((entry) => entry.durationStable).length} of ${evaluableClasses.length} evaluable class(es) retain duration accuracy.`,
    },
    {
      id: "capacity-stability",
      passed: evaluableClasses.length > 0 && evaluableClasses.every((entry) => entry.capacityStable),
      detail: `${evaluableClasses.filter((entry) => entry.capacityStable).length} of ${evaluableClasses.length} evaluable class(es) retain capacity accuracy.`,
    },
    {
      id: "error-reduction-retention",
      passed: evaluableClasses.length > 0 && evaluableClasses.every((entry) => entry.improvementRetained),
      detail: `${evaluableClasses.filter((entry) => entry.improvementRetained).length} of ${evaluableClasses.length} evaluable class(es) retain the declared minimum improvement.`,
    },
    {
      id: "evidence-lineage",
      passed: lineageComplete,
      detail: "Every assessment retains schedule, delivery, adoption, customer, and reviewed outcome lineage.",
    },
  ];

  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede monitor asOf");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["retain", "investigate", "recalibrate"].includes(decision))
    throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  const candidates = referenceClasses
    .filter((entry) => entry.evaluable && !entry.stable)
    .map((entry) => entry.referenceClass);

  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourceAssessmentIds: reports.map((report) => report.id),
    status: decision === "retain"
      ? (allPassed ? "stable_calibration" : "blocked_retention")
      : "action_required",
    policy: {
      baselineReportCount,
      recentReportCount,
      minimumItemsPerClass,
      maximumAssessmentGapDays,
      maximumReportAgeDays,
      maximumDurationErrorRate,
      maximumCapacityErrorRate,
      maximumErrorIncreaseRate,
      minimumErrorReductionRate,
      minimumClassCoverageRate,
    },
    summary: {
      reports: reports.length,
      baselineReports: baselineReports.length,
      recentReports: recentReports.length,
      referenceClasses: referenceClasses.length,
      evaluableClasses: evaluableClasses.length,
      stableClasses: referenceClasses.filter((entry) => entry.stable).length,
      recalibrationCandidates: candidates.length,
      classCoverageRate,
      maximumObservedGapDays,
      latestReportAgeDays,
    },
    checks,
    referenceClasses,
    recalibrationCandidates: candidates,
    assessmentGaps,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic rolling-window comparison of Project 46 calibrated duration/capacity error and error reduction by declared reference class; thresholds are policy signals rather than statistical control limits, detected drift is not causal proof, and the monitor never recalculates factors, changes estimates or schedules, or evaluates people",
  };
}
