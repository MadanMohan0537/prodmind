const DAY = 86_400_000;

const FAILURE_WEIGHTS = {
  "approved-schedule": 10,
  "snapshot-coverage": 5,
  "snapshot-cadence": 6,
  "schedule-performance": 9,
  "capacity-variance": 8,
  "dependency-integrity": 10,
  "deadline-control": 10,
  "blocker-control": 8,
  "evidence-lineage": 10,
};

const TYPE_TARGETS = {
  schedule_repair: ["approved-schedule", "schedule-performance"],
  capacity_adjustment: ["capacity-variance", "schedule-performance"],
  dependency_recovery: ["dependency-integrity", "schedule-performance"],
  blocker_resolution: ["blocker-control", "schedule-performance"],
  evidence_remediation: ["snapshot-coverage", "snapshot-cadence", "evidence-lineage"],
  scope_decision: ["schedule-performance", "deadline-control", "capacity-variance"],
  deadline_decision: ["deadline-control", "schedule-performance"],
};

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

function timestamp(value, name) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

function date(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${name} must be an ISO date`);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value)
    throw new Error(`${name} must be a real ISO date`);
  return value;
}

const days = (from, to) =>
  Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const round = (value) => Number(value.toFixed(4));

function normalizeSources(schedule, delivery) {
  if (
    schedule?.schemaVersion !== "1.0.0" ||
    typeof schedule.id !== "string" ||
    !Array.isArray(schedule.schedule) ||
    !schedule.schedule.length ||
    schedule.schedule.length > 8
  ) throw new Error("Provide a bounded Project 40 schedule report");
  if (
    delivery?.schemaVersion !== "1.0.0" ||
    typeof delivery.id !== "string" ||
    !Array.isArray(delivery.checks) ||
    !Array.isArray(delivery.items) ||
    delivery.sourceScheduleId !== schedule.id
  ) throw new Error("Provide a matching Project 41 delivery report");
  const scheduleIds = new Set(schedule.schedule.map((item) => text(item.portfolioItemId, "schedule item id", 240)));
  if (scheduleIds.size !== schedule.schedule.length)
    throw new Error("Project 40 schedule item IDs must be unique");
  const deliveryIds = delivery.items.map((item) => text(item.portfolioItemId, "delivery item id", 240));
  if (deliveryIds.length !== scheduleIds.size || new Set(deliveryIds).size !== deliveryIds.length || deliveryIds.some((id) => !scheduleIds.has(id)))
    throw new Error("Project 41 items must exactly cover Project 40 work");
  const checkIds = new Set();
  const failedChecks = delivery.checks.filter((check) => {
    const id = text(check.id, "delivery check id", 80);
    if (checkIds.has(id) || !(id in FAILURE_WEIGHTS) || typeof check.passed !== "boolean")
      throw new Error("Project 41 checks are invalid or duplicated");
    checkIds.add(id);
    return !check.passed;
  }).map((check) => check.id);
  if (!failedChecks.length)
    throw new Error("Project 41 has no failed control requiring recovery");
  return { scheduleIds, failedChecks };
}

function normalizeCandidates(raw, context, asOfDate, horizonEnd) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 16)
    throw new Error("Provide 1–16 recovery candidates");
  const ids = new Set();
  const candidates = raw.map((candidate, index) => {
    const id = text(candidate.id, `candidate ${index + 1} id`, 120);
    if (ids.has(id)) throw new Error("Recovery candidate IDs must be unique");
    ids.add(id);
    const type = text(candidate.type, `${id} type`, 40);
    if (!(type in TYPE_TARGETS)) throw new Error(`${id} type is invalid`);
    if (!Array.isArray(candidate.targetCheckIds) || !candidate.targetCheckIds.length)
      throw new Error(`${id} must target failed Project 41 checks`);
    const targetCheckIds = candidate.targetCheckIds.map((value) => text(value, `${id} target check`, 80));
    if (new Set(targetCheckIds).size !== targetCheckIds.length || targetCheckIds.some((value) => !context.failedChecks.includes(value)))
      throw new Error(`${id} may target only unique failed Project 41 checks`);
    if (targetCheckIds.some((value) => !TYPE_TARGETS[type].includes(value)))
      throw new Error(`${id} type is incompatible with its target check`);
    if (!Array.isArray(candidate.portfolioItemIds) || !candidate.portfolioItemIds.length)
      throw new Error(`${id} must identify affected portfolio items`);
    const portfolioItemIds = candidate.portfolioItemIds.map((value) => text(value, `${id} portfolio item`, 240));
    if (new Set(portfolioItemIds).size !== portfolioItemIds.length || portfolioItemIds.some((value) => !context.scheduleIds.has(value)))
      throw new Error(`${id} contains unknown or duplicate portfolio items`);
    const dueAt = date(candidate.dueAt, `${id} dueAt`);
    if (dueAt < asOfDate || dueAt > horizonEnd)
      throw new Error(`${id} dueAt must fall from asOf through the planning horizon`);
    const dependencies = Array.isArray(candidate.dependencies)
      ? candidate.dependencies.map((value) => text(value, `${id} dependency`, 120))
      : [];
    if (new Set(dependencies).size !== dependencies.length || dependencies.includes(id))
      throw new Error(`${id} dependencies must be unique and cannot reference itself`);
    const changesBaseline = Boolean(candidate.changesBaseline);
    if (["scope_decision", "deadline_decision"].includes(type) !== changesBaseline)
      throw new Error(`${id} baseline-change declaration is inconsistent with its type`);
    return {
      id,
      type,
      title: text(candidate.title, `${id} title`, 240),
      owner: text(candidate.owner, `${id} owner`, 120),
      targetCheckIds,
      portfolioItemIds,
      effortDays: number(candidate.effortDays, `${id} effortDays`, 0.1, 1000),
      dueAt,
      dependencies,
      changesBaseline,
      reversible: Boolean(candidate.reversible),
      rationale: text(candidate.rationale, `${id} rationale`, 1000),
      exitCriteria: text(candidate.exitCriteria, `${id} exitCriteria`, 1000),
      evidence: text(candidate.evidence, `${id} evidence`, 1000),
    };
  });
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  for (const candidate of candidates)
    for (const dependency of candidate.dependencies) {
      if (!ids.has(dependency)) throw new Error(`${candidate.id} has an unknown dependency`);
      if (candidateMap.get(dependency).dueAt > candidate.dueAt)
        throw new Error(`${candidate.id} cannot be due before its dependency`);
    }
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 1) throw new Error("Recovery candidate dependencies contain a cycle");
    if (state.get(id) === 2) return;
    state.set(id, 1);
    const candidate = candidates.find((entry) => entry.id === id);
    for (const dependency of candidate.dependencies) visit(dependency);
    state.set(id, 2);
  };
  for (const candidate of candidates) visit(candidate.id);
  return candidates;
}

function selectionKey(selected, context) {
  const covered = new Set(selected.flatMap((candidate) => candidate.targetCheckIds));
  const coverageWeight = [...covered].reduce((sum, id) => sum + FAILURE_WEIGHTS[id], 0);
  const effort = selected.reduce((sum, candidate) => sum + candidate.effortDays, 0);
  const baselineChanges = selected.filter((candidate) => candidate.changesBaseline).length;
  const irreversible = selected.filter((candidate) => !candidate.reversible).length;
  const latestDue = selected.length ? Math.max(...selected.map((candidate) => Date.parse(`${candidate.dueAt}T00:00:00Z`))) : Infinity;
  return { covered, coverageWeight, effort, baselineChanges, irreversible, latestDue, count: selected.length, allWeight: context.failedChecks.reduce((sum, id) => sum + FAILURE_WEIGHTS[id], 0) };
}

function better(left, right) {
  if (!right) return true;
  const keys = ["coverageWeight"];
  for (const key of keys) if (left[key] !== right[key]) return left[key] > right[key];
  for (const key of ["baselineChanges", "irreversible", "effort", "latestDue", "count"])
    if (left[key] !== right[key]) return left[key] < right[key];
  return false;
}

export function planRoadmapRecovery(runs, scheduleReport, deliveryReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const context = normalizeSources(scheduleReport, deliveryReport);
  const id = text(input.id, "recovery plan id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  const deliveryAsOf = timestamp(deliveryReport.asOf, "Project 41 asOf");
  if (asOf < deliveryAsOf) throw new Error("recovery planning cannot precede Project 41");
  const asOfDate = asOf.slice(0, 10);
  const horizonEnd = date(input.horizonEnd, "horizonEnd");
  if (horizonEnd < asOfDate || days(asOfDate, horizonEnd) > 180)
    throw new Error("horizonEnd must be within 180 days from asOf");
  const capacityDays = number(input.capacityDays, "capacityDays", 0.1, 10_000);
  const minimumCoverageRate = number(input.minimumCoverageRate, "minimumCoverageRate", 0, 1);
  const candidates = normalizeCandidates(input.candidates, context, asOfDate, horizonEnd);
  let best = null;
  let bestMetrics = null;
  let feasibleCombinations = 0;
  for (let mask = 1; mask < 2 ** candidates.length; mask++) {
    const selected = candidates.filter((_, index) => mask & (1 << index));
    const selectedIds = new Set(selected.map((candidate) => candidate.id));
    if (selected.some((candidate) => candidate.dependencies.some((dependency) => !selectedIds.has(dependency)))) continue;
    const metrics = selectionKey(selected, context);
    if (metrics.effort > capacityDays) continue;
    feasibleCombinations++;
    if (better(metrics, bestMetrics)) { best = selected; bestMetrics = metrics; }
  }
  if (!best) best = [];
  if (!bestMetrics) bestMetrics = selectionKey([], context);
  const coverageRate = bestMetrics.allWeight ? round(bestMetrics.coverageWeight / bestMetrics.allWeight) : 0;
  const uncoveredCheckIds = context.failedChecks.filter((id) => !bestMetrics.covered.has(id));
  const selectedIds = new Set(best.map((candidate) => candidate.id));
  const checks = [
    { id: "recovery-needed", passed: context.failedChecks.length > 0, detail: `${context.failedChecks.length} failed Project 41 control(s) require a recovery decision.` },
    { id: "target-coverage", passed: coverageRate >= minimumCoverageRate, detail: `Weighted failed-control coverage is ${coverageRate}; minimum is ${minimumCoverageRate}.` },
    { id: "capacity-feasibility", passed: bestMetrics.effort <= capacityDays, detail: `${round(bestMetrics.effort)} of ${capacityDays} recovery capacity-day(s) selected.` },
    { id: "dependency-completeness", passed: best.every((candidate) => candidate.dependencies.every((dependency) => selectedIds.has(dependency))), detail: "Every selected action retains its declared prerequisite actions." },
    { id: "accountability", passed: best.every((candidate) => candidate.owner && candidate.dueAt && candidate.exitCriteria && candidate.evidence), detail: "Every selected action has an owner, due date, exit criteria, and planning evidence." },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf || reviewedAt > `${horizonEnd}T23:59:59.999Z`)
    throw new Error("review must occur from asOf through the planning horizon");
  const decision = text(input.review?.decision, "review decision", 20);
  if (!["approve", "revise", "defer"].includes(decision))
    throw new Error("review decision is invalid");
  const passed = checks.every((check) => check.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    horizonEnd,
    sourceScheduleId: scheduleReport.id,
    sourceDeliveryMonitorId: deliveryReport.id,
    status: decision === "approve" ? (passed ? "approved_recovery_plan" : "blocked_approval") : "action_required",
    failedCheckIds: context.failedChecks,
    uncoveredCheckIds,
    summary: {
      failedChecks: context.failedChecks.length,
      candidates: candidates.length,
      selectedActions: best.length,
      coverageRate,
      capacityDays,
      selectedEffortDays: round(bestMetrics.effort),
      remainingCapacityDays: round(capacityDays - bestMetrics.effort),
      baselineChanges: bestMetrics.baselineChanges,
      irreversibleActions: bestMetrics.irreversible,
      combinationsEvaluated: 2 ** candidates.length - 1,
      feasibleCombinations,
    },
    selectedActions: best.map((candidate) => ({
      ...candidate,
      sourceEvidenceIds: [...new Set(scheduleReport.schedule.filter((item) => candidate.portfolioItemIds.includes(item.portfolioItemId)).flatMap((item) => item.evidenceIds ?? []))],
    })),
    deferredCandidates: candidates.filter((candidate) => !selectedIds.has(candidate.id)).map((candidate) => candidate.id),
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method: "deterministic bounded recovery-action selection maximizing unique severity-weighted failed-control coverage before minimizing baseline changes, irreversible actions, effort, due date, and action count; the result is a reviewed scenario, not an executed schedule change, staffing decision, forecast, causal claim, or certified EVM corrective-action plan",
  };
}
