const DAY = 86_400_000;

function text(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function number(value, name, min, max) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be a number from ${min} to ${max}`);
  return value;
}

function isoDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${name} must be an ISO date`);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${name} must be a real ISO date`);
  return value;
}

function timestamp(value, name) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

const day = (value) =>
  Math.floor(Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`) / DAY);
const round = (value) => Number(value.toFixed(4));

function normalizeSchedule(report) {
  if (
    report?.schemaVersion !== "1.0.0" ||
    typeof report.id !== "string" ||
    !Array.isArray(report.schedule) ||
    !report.schedule.length ||
    report.schedule.length > 8
  )
    throw new Error("Provide a bounded Project 40 roadmap schedule report");
  text(report.id, "Project 40 schedule id", 120);
  timestamp(report.asOf, "Project 40 schedule asOf");
  const ids = new Set();
  const rows = report.schedule.map((entry, index) => {
    const id = text(
      entry.portfolioItemId,
      `Schedule item ${index + 1} id`,
      240,
    );
    if (ids.has(id)) throw new Error("Schedule item IDs must be unique");
    ids.add(id);
    if (!Array.isArray(entry.workDates) || !entry.workDates.length)
      throw new Error(`${id} must contain scheduled work dates`);
    const workDates = entry.workDates.map((value, workIndex) =>
      isoDate(value, `${id} work date ${workIndex + 1}`),
    );
    if (
      new Set(workDates).size !== workDates.length ||
      workDates.some(
        (value, workIndex) => workIndex && value <= workDates[workIndex - 1],
      )
    )
      throw new Error(`${id} work dates must be unique and increasing`);
    if (!Array.isArray(entry.dependencies) || entry.dependencies.length > 8)
      throw new Error(`${id} dependencies must be a bounded array`);
    if (!Array.isArray(entry.evidenceIds) || !entry.evidenceIds.length)
      throw new Error(`${id} must retain evidence IDs`);
    if (new Set(entry.evidenceIds).size !== entry.evidenceIds.length)
      throw new Error(`${id} evidence IDs must be unique`);
    const capacity = integer(entry.capacity, `${id} capacity`, 1, 20);
    const durationDays = integer(
      entry.durationDays,
      `${id} durationDays`,
      1,
      180,
    );
    if (workDates.length !== durationDays)
      throw new Error(`${id} work dates must match durationDays`);
    const start = isoDate(entry.start, `${id} start`);
    const finish = isoDate(entry.finish, `${id} finish`);
    const deadline = isoDate(entry.deadline, `${id} deadline`);
    if (
      start !== workDates[0] ||
      finish !== workDates.at(-1) ||
      deadline < start
    )
      throw new Error(`${id} schedule dates are inconsistent`);
    return {
      ...entry,
      portfolioItemId: id,
      runId: text(entry.runId, `${id} runId`, 120),
      opportunityId: text(entry.opportunityId, `${id} opportunityId`, 120),
      title: text(entry.title, `${id} title`, 240),
      owner: text(entry.owner, `${id} owner`, 120),
      teamId: text(entry.teamId, `${id} teamId`, 80),
      dependencies: entry.dependencies.map((value, dependencyIndex) =>
        text(value, `${id} dependency ${dependencyIndex + 1}`, 240),
      ),
      evidenceIds: entry.evidenceIds.map((value, evidenceIndex) =>
        text(value, `${id} evidence ${evidenceIndex + 1}`, 240),
      ),
      capacity,
      durationDays,
      workDates,
      start,
      finish,
      deadline,
      plannedWorkUnits: capacity * durationDays,
    };
  });
  for (const row of rows)
    for (const dependency of row.dependencies)
      if (!ids.has(dependency))
        throw new Error(`${row.portfolioItemId} has an unknown dependency`);
  return rows;
}

function normalizeBlockers(raw, itemId, observedDate) {
  if (!Array.isArray(raw) || raw.length > 10)
    throw new Error(`${itemId} blockers must be an array of at most 10`);
  const ids = new Set();
  return raw.map((entry, index) => {
    const id = text(entry.id, `${itemId} blocker ${index + 1} id`, 120);
    if (ids.has(id)) throw new Error(`${itemId} blocker IDs must be unique`);
    ids.add(id);
    const type = text(entry.type, `${id} type`, 30);
    if (
      !["dependency", "capacity", "scope", "technical", "external"].includes(
        type,
      )
    )
      throw new Error(`${id} blocker type is invalid`);
    const dueAt = isoDate(entry.dueAt, `${id} dueAt`);
    return {
      id,
      type,
      owner: text(entry.owner, `${id} owner`, 120),
      dueAt,
      detail: text(entry.detail, `${id} detail`, 1000),
      evidence: text(entry.evidence, `${id} evidence`, 1000),
      overdue: dueAt < observedDate,
    };
  });
}

function normalizeItem(raw, plan, snapshotId, observedDate) {
  const status = text(
    raw.status,
    `${snapshotId} ${plan.portfolioItemId} status`,
    30,
  );
  if (!["not_started", "in_progress", "blocked", "completed"].includes(status))
    throw new Error(`${plan.portfolioItemId} status is invalid`);
  const completedWorkUnits = integer(
    raw.completedWorkUnits,
    `${plan.portfolioItemId} completedWorkUnits`,
    0,
    plan.plannedWorkUnits,
  );
  const actualCapacityDays = number(
    raw.actualCapacityDays,
    `${plan.portfolioItemId} actualCapacityDays`,
    0,
    10_000,
  );
  const remainingEstimateDays = integer(
    raw.remainingEstimateDays,
    `${plan.portfolioItemId} remainingEstimateDays`,
    0,
    180,
  );
  const actualStart = raw.actualStart
    ? isoDate(raw.actualStart, `${plan.portfolioItemId} actualStart`)
    : null;
  const actualFinish = raw.actualFinish
    ? isoDate(raw.actualFinish, `${plan.portfolioItemId} actualFinish`)
    : null;
  if (actualStart && actualStart > observedDate)
    throw new Error(
      `${plan.portfolioItemId} actualStart cannot follow observation`,
    );
  if (
    actualFinish &&
    (!actualStart || actualFinish < actualStart || actualFinish > observedDate)
  )
    throw new Error(`${plan.portfolioItemId} actualFinish is inconsistent`);
  if (
    status === "not_started" &&
    (completedWorkUnits || actualCapacityDays || actualStart || actualFinish)
  )
    throw new Error(
      `${plan.portfolioItemId} not_started values are inconsistent`,
    );
  if ((completedWorkUnits || actualCapacityDays) && !actualStart)
    throw new Error(
      `${plan.portfolioItemId} observed work requires actualStart`,
    );
  if (
    status === "in_progress" &&
    (!actualStart ||
      actualFinish ||
      completedWorkUnits >= plan.plannedWorkUnits)
  )
    throw new Error(
      `${plan.portfolioItemId} in_progress values are inconsistent`,
    );
  if (
    status === "completed" &&
    (!actualFinish ||
      completedWorkUnits !== plan.plannedWorkUnits ||
      remainingEstimateDays)
  )
    throw new Error(
      `${plan.portfolioItemId} completed values are inconsistent`,
    );
  if (status !== "completed" && actualFinish)
    throw new Error(
      `${plan.portfolioItemId} only completed work can have actualFinish`,
    );
  if (status !== "completed" && remainingEstimateDays === 0)
    throw new Error(
      `${plan.portfolioItemId} incomplete work needs a remaining estimate`,
    );
  const blockers = normalizeBlockers(
    raw.blockers ?? [],
    plan.portfolioItemId,
    observedDate,
  );
  if (status === "blocked" && !blockers.length)
    throw new Error(
      `${plan.portfolioItemId} blocked status requires a blocker`,
    );
  return {
    portfolioItemId: plan.portfolioItemId,
    status,
    completedWorkUnits,
    actualCapacityDays,
    remainingEstimateDays,
    actualStart,
    actualFinish,
    evidence: text(
      raw.evidence,
      `${plan.portfolioItemId} progress evidence`,
      1000,
    ),
    blockers,
  };
}

function normalizeSnapshots(raw, plans, asOf) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 24)
    throw new Error("Provide 1–24 delivery snapshots");
  const planMap = new Map(plans.map((entry) => [entry.portfolioItemId, entry]));
  const snapshotIds = new Set();
  let previous = null;
  return raw.map((entry, index) => {
    const id = text(entry.id, `Snapshot ${index + 1} id`, 120);
    if (snapshotIds.has(id)) throw new Error("Snapshot IDs must be unique");
    snapshotIds.add(id);
    const observedAt = timestamp(entry.observedAt, `${id} observedAt`);
    if (Date.parse(observedAt) > Date.parse(asOf))
      throw new Error(`${id} cannot be observed after asOf`);
    if (previous && observedAt <= previous.observedAt)
      throw new Error("Snapshots must be strictly chronological");
    if (!Array.isArray(entry.items) || entry.items.length !== plans.length)
      throw new Error(`${id} must cover every scheduled item exactly once`);
    const itemIds = new Set();
    const items = entry.items.map((item) => {
      const itemId = text(item.portfolioItemId, `${id} item id`, 240);
      if (!planMap.has(itemId))
        throw new Error(`${id} references unknown scheduled work`);
      if (itemIds.has(itemId)) throw new Error(`${id} item IDs must be unique`);
      itemIds.add(itemId);
      return normalizeItem(
        item,
        planMap.get(itemId),
        id,
        observedAt.slice(0, 10),
      );
    });
    if (previous) {
      const oldItems = new Map(
        previous.items.map((item) => [item.portfolioItemId, item]),
      );
      for (const item of items) {
        const old = oldItems.get(item.portfolioItemId);
        if (
          item.completedWorkUnits < old.completedWorkUnits ||
          item.actualCapacityDays < old.actualCapacityDays
        )
          throw new Error(`${item.portfolioItemId} progress cannot decrease`);
        if (old.status === "completed" && item.status !== "completed")
          throw new Error(
            `${item.portfolioItemId} cannot leave completed status`,
          );
        if (old.actualStart && item.actualStart !== old.actualStart)
          throw new Error(`${item.portfolioItemId} actualStart cannot change`);
        if (old.actualFinish && item.actualFinish !== old.actualFinish)
          throw new Error(`${item.portfolioItemId} actualFinish cannot change`);
      }
    }
    previous = { id, observedAt, items };
    return previous;
  });
}

function itemMetrics(plan, item, observedDate) {
  const plannedWorkUnits =
    plan.workDates.filter((value) => value <= observedDate).length *
    plan.capacity;
  const scheduleVarianceUnits = item.completedWorkUnits - plannedWorkUnits;
  const schedulePerformanceIndex = plannedWorkUnits
    ? round(item.completedWorkUnits / plannedWorkUnits)
    : null;
  const capacityVarianceDays = round(
    item.actualCapacityDays - item.completedWorkUnits,
  );
  const capacityOverrunRate = plan.plannedWorkUnits
    ? round(Math.max(0, capacityVarianceDays) / plan.plannedWorkUnits)
    : 0;
  return {
    ...plan,
    ...item,
    plannedWorkUnits,
    plannedTotalWorkUnits: plan.plannedWorkUnits,
    completionRate: round(item.completedWorkUnits / plan.plannedWorkUnits),
    scheduleVarianceUnits,
    schedulePerformanceIndex,
    capacityVarianceDays,
    capacityOverrunRate,
    startVarianceDays: item.actualStart
      ? day(item.actualStart) - day(plan.start)
      : null,
    finishVarianceDays: item.actualFinish
      ? day(item.actualFinish) - day(plan.finish)
      : null,
    overdue: item.status !== "completed" && observedDate > plan.deadline,
    deadlineMet: item.actualFinish ? item.actualFinish <= plan.deadline : null,
  };
}

export function monitorRoadmapDelivery(runs, scheduleReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const plans = normalizeSchedule(scheduleReport);
  const id = text(input.id, "delivery monitor id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const minimumSnapshots = integer(
    input.minimumSnapshots,
    "minimumSnapshots",
    1,
    24,
  );
  const maximumSnapshotGapDays = integer(
    input.maximumSnapshotGapDays,
    "maximumSnapshotGapDays",
    1,
    30,
  );
  const minimumSchedulePerformanceIndex = number(
    input.minimumSchedulePerformanceIndex,
    "minimumSchedulePerformanceIndex",
    0,
    1,
  );
  const maximumCapacityOverrunRate = number(
    input.maximumCapacityOverrunRate,
    "maximumCapacityOverrunRate",
    0,
    1,
  );
  const snapshots = normalizeSnapshots(input.snapshots, plans, asOf);
  const scheduleAsOf = timestamp(
    scheduleReport.asOf,
    "Project 40 schedule asOf",
  );
  if (snapshots[0].observedAt < scheduleAsOf)
    throw new Error(
      "delivery snapshots cannot precede the Project 40 baseline",
    );
  const latest = snapshots.at(-1);
  const observedDate = latest.observedAt.slice(0, 10);
  const metrics = latest.items.map((item) =>
    itemMetrics(
      plans.find((plan) => plan.portfolioItemId === item.portfolioItemId),
      item,
      observedDate,
    ),
  );
  const metricMap = new Map(
    metrics.map((item) => [item.portfolioItemId, item]),
  );
  const dependencyViolations = metrics.flatMap((item) =>
    item.actualStart
      ? item.dependencies
          .filter((dependency) => {
            const source = metricMap.get(dependency);
            return (
              !source.actualFinish || source.actualFinish >= item.actualStart
            );
          })
          .map((dependency) => ({
            portfolioItemId: item.portfolioItemId,
            dependency,
          }))
      : [],
  );
  const gaps = snapshots.slice(1).map((snapshot, index) => ({
    from: snapshots[index].id,
    to: snapshot.id,
    days: day(snapshot.observedAt) - day(snapshots[index].observedAt),
  }));
  const freshnessDays = day(asOf) - day(latest.observedAt);
  const plannedWorkUnits = metrics.reduce(
    (sum, item) => sum + item.plannedWorkUnits,
    0,
  );
  const earnedWorkUnits = metrics.reduce(
    (sum, item) => sum + item.completedWorkUnits,
    0,
  );
  const actualCapacityDays = round(
    metrics.reduce((sum, item) => sum + item.actualCapacityDays, 0),
  );
  const totalPlannedWorkUnits = metrics.reduce(
    (sum, item) => sum + item.plannedTotalWorkUnits,
    0,
  );
  const capacityOverrunRate = totalPlannedWorkUnits
    ? round(
        Math.max(0, actualCapacityDays - earnedWorkUnits) /
          totalPlannedWorkUnits,
      )
    : 0;
  const schedulePerformanceIndex = plannedWorkUnits
    ? round(earnedWorkUnits / plannedWorkUnits)
    : null;
  const blockers = metrics.flatMap((item) =>
    item.blockers.map((blocker) => ({
      ...blocker,
      portfolioItemId: item.portfolioItemId,
    })),
  );
  const checks = [
    {
      id: "approved-schedule",
      passed: scheduleReport.status === "approved_schedule",
      detail: "Project 40 must provide an approved schedule baseline.",
    },
    {
      id: "snapshot-coverage",
      passed: snapshots.length >= minimumSnapshots,
      detail: `${snapshots.length} snapshot(s) supplied; ${minimumSnapshots} required.`,
    },
    {
      id: "snapshot-cadence",
      passed:
        freshnessDays <= maximumSnapshotGapDays &&
        gaps.every((gap) => gap.days <= maximumSnapshotGapDays),
      detail: `${freshnessDays} day(s) since the latest snapshot; maximum observed gap ${Math.max(0, ...gaps.map((gap) => gap.days))} day(s).`,
    },
    {
      id: "schedule-performance",
      passed:
        schedulePerformanceIndex === null ||
        schedulePerformanceIndex >= minimumSchedulePerformanceIndex,
      detail: `Schedule performance index is ${schedulePerformanceIndex ?? "not yet measurable"}; minimum is ${minimumSchedulePerformanceIndex}.`,
    },
    {
      id: "capacity-variance",
      passed: capacityOverrunRate <= maximumCapacityOverrunRate,
      detail: `Capacity overrun rate is ${capacityOverrunRate}; maximum is ${maximumCapacityOverrunRate}.`,
    },
    {
      id: "dependency-integrity",
      passed: dependencyViolations.length === 0,
      detail: `${dependencyViolations.length} actual dependency sequencing violation(s).`,
    },
    {
      id: "deadline-control",
      passed: metrics.every(
        (item) => !item.overdue && item.deadlineMet !== false,
      ),
      detail: `${metrics.filter((item) => item.overdue || item.deadlineMet === false).length} overdue or late item(s).`,
    },
    {
      id: "blocker-control",
      passed: blockers.every((blocker) => !blocker.overdue),
      detail: `${blockers.filter((blocker) => blocker.overdue).length} overdue blocker(s).`,
    },
    {
      id: "evidence-lineage",
      passed: metrics.every((item) => item.evidenceIds.length && item.evidence),
      detail:
        "Every item retains source evidence and current progress evidence.",
    },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (
    reviewedAt < latest.observedAt ||
    Date.parse(reviewedAt) > Date.parse(asOf)
  )
    throw new Error(
      "review must occur from the latest observation through asOf",
    );
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["continue", "replan", "escalate"].includes(decision))
    throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  const status =
    decision === "continue"
      ? allPassed
        ? "controlled_delivery"
        : "blocked_continue"
      : "action_required";
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourceScheduleId: scheduleReport.id,
    sourceScheduleAsOf: scheduleAsOf,
    sourcePortfolioItemIds: plans.map((plan) => plan.portfolioItemId),
    status,
    summary: {
      items: metrics.length,
      completed: metrics.filter((item) => item.status === "completed").length,
      inProgress: metrics.filter((item) => item.status === "in_progress")
        .length,
      blocked: metrics.filter((item) => item.status === "blocked").length,
      overdue: metrics.filter((item) => item.overdue).length,
      openBlockers: blockers.length,
      overdueBlockers: blockers.filter((blocker) => blocker.overdue).length,
      plannedWorkUnits,
      earnedWorkUnits,
      actualCapacityDays,
      schedulePerformanceIndex,
      capacityOverrunRate,
      snapshots: snapshots.length,
      latestObservedAt: latest.observedAt,
    },
    checks,
    items: metrics,
    dependencyViolations,
    snapshotGaps: gaps,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "deterministic baseline-versus-actual monitoring using time-phased planned work units, declared earned work, consumed capacity, dependency sequencing, deadlines, snapshot cadence, owned blockers, and evidence; indices are descriptive controls, not delivery probability, causality, employee performance, certified EVM, or authority to change roadmap state",
  };
}
