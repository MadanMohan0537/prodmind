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

const day = (value) => Math.floor(Date.parse(value) / DAY);
const round = (value) => Number(value.toFixed(4));

function normalizeSources(schedule, baseline, plan, followup) {
  if (
    schedule?.schemaVersion !== "1.0.0" ||
    !Array.isArray(schedule.schedule) ||
    !schedule.schedule.length ||
    schedule.schedule.length > 100
  )
    throw new Error("Provide a Project 40 schedule report");
  if (baseline?.schemaVersion !== "1.0.0" || baseline.sourceScheduleId !== schedule.id || !Array.isArray(baseline.checks))
    throw new Error("Provide a matching baseline Project 41 report");
  if (
    plan?.schemaVersion !== "1.0.0" ||
    plan.status !== "approved_recovery_plan" ||
    plan.sourceScheduleId !== schedule.id ||
    plan.sourceDeliveryMonitorId !== baseline.id ||
    !Array.isArray(plan.selectedActions) ||
    !plan.selectedActions.length ||
    plan.selectedActions.length > 16 ||
    !Array.isArray(plan.failedCheckIds) ||
    !plan.failedCheckIds.length
  ) throw new Error("Provide an approved matching Project 42 recovery plan");
  if (
    followup?.schemaVersion !== "1.0.0" ||
    followup.sourceScheduleId !== schedule.id ||
    !Array.isArray(followup.checks) ||
    !Array.isArray(followup.items)
  ) throw new Error("Provide a matching follow-up Project 41 report");
  const baselineAsOf = timestamp(baseline.asOf, "baseline Project 41 asOf");
  const planAsOf = timestamp(plan.asOf, "Project 42 asOf");
  const followupAsOf = timestamp(followup.asOf, "follow-up Project 41 asOf");
  if (planAsOf < baselineAsOf || followupAsOf <= planAsOf)
    throw new Error("Project 40–42 and follow-up chronology is invalid");
  const originalFailures = new Set(plan.failedCheckIds.map((id) => text(id, "failed check id", 80)));
  const baselineFailures = new Set(baseline.checks.filter((check) => !check.passed).map((check) => check.id));
  if (originalFailures.size !== plan.failedCheckIds.length || [...originalFailures].some((id) => !baselineFailures.has(id)))
    throw new Error("Project 42 failed checks must originate in baseline Project 41");
  const followupChecks = new Map();
  for (const check of followup.checks) {
    const id = text(check.id, "follow-up check id", 80);
    if (followupChecks.has(id) || typeof check.passed !== "boolean")
      throw new Error("Follow-up Project 41 checks are invalid or duplicated");
    followupChecks.set(id, check);
  }
  if ([...originalFailures].some((id) => !followupChecks.has(id)))
    throw new Error("Follow-up Project 41 must reassess every failed control");
  const itemIds = new Set(schedule.schedule.map((item) => text(item.portfolioItemId, "schedule item id", 240)));
  if (itemIds.size !== schedule.schedule.length)
    throw new Error("Project 40 schedule item IDs must be unique");
  const followupItems = followup.items.map((item) => text(item.portfolioItemId, "follow-up item id", 240));
  if (
    followupItems.length !== itemIds.size ||
    new Set(followupItems).size !== itemIds.size ||
    followupItems.some((id) => !itemIds.has(id))
  )
    throw new Error("Follow-up Project 41 items must cover scheduled work exactly");
  return { baselineAsOf, planAsOf, followupAsOf, originalFailures, followupChecks, itemIds };
}

function normalizeOutcomes(raw, actions, asOf, maximumEffortVarianceRate) {
  if (!Array.isArray(raw) || raw.length !== actions.length)
    throw new Error("Provide exactly one outcome for every selected Project 42 action");
  const actionMap = new Map(actions.map((action) => [text(action.id, "selected action id", 120), action]));
  if (actionMap.size !== actions.length) throw new Error("Selected Project 42 action IDs must be unique");
  const seen = new Set();
  return raw.map((outcome, index) => {
    const actionId = text(outcome.actionId, `outcome ${index + 1} actionId`, 120);
    if (!actionMap.has(actionId) || seen.has(actionId))
      throw new Error("Action outcomes contain unknown or duplicate identities");
    seen.add(actionId);
    const action = actionMap.get(actionId);
    const plannedEffortDays = number(action.effortDays, `${actionId} planned effortDays`, 0.1, 1000);
    const dueAt = timestamp(`${text(action.dueAt, `${actionId} dueAt`, 10)}T23:59:59Z`, `${actionId} dueAt`).slice(0, 10);
    if (!Array.isArray(action.portfolioItemIds) || !action.portfolioItemIds.length)
      throw new Error(`${actionId} must identify affected portfolio items`);
    if (!Array.isArray(action.sourceEvidenceIds) || !action.sourceEvidenceIds.length)
      throw new Error(`${actionId} must preserve source evidence lineage`);
    const status = text(outcome.status, `${actionId} status`, 30);
    if (!["not_started", "in_progress", "completed"].includes(status))
      throw new Error(`${actionId} status is invalid`);
    const actualEffortDays = number(outcome.actualEffortDays, `${actionId} actualEffortDays`, 0, 10_000);
    const completedAt = outcome.completedAt ? timestamp(outcome.completedAt, `${actionId} completedAt`) : null;
    if ((status === "completed") !== Boolean(completedAt))
      throw new Error(`${actionId} completion status and date are inconsistent`);
    if (completedAt && completedAt > asOf)
      throw new Error(`${actionId} cannot complete after asOf`);
    const approval = outcome.baselineChangeApproval ?? null;
    if (action.changesBaseline && status === "completed") {
      if (
        !approval ||
        approval.decision !== "approved" ||
        timestamp(approval.reviewedAt, `${actionId} baseline approval reviewedAt`) > completedAt
      ) throw new Error(`${actionId} requires prior baseline-change approval`);
    } else if (approval) {
      throw new Error(`${actionId} must not attach an unnecessary baseline-change approval`);
    }
    const effortLimit = plannedEffortDays * (1 + maximumEffortVarianceRate);
    return {
      actionId,
      status,
      completedAt,
      actualEffortDays,
      plannedEffortDays,
      effortVarianceDays: round(actualEffortDays - plannedEffortDays),
      effortWithinTolerance: actualEffortDays <= effortLimit,
      onTime: completedAt ? completedAt.slice(0, 10) <= dueAt : false,
      executionEvidence: text(outcome.executionEvidence, `${actionId} executionEvidence`, 1000),
      exitEvidence: text(outcome.exitEvidence, `${actionId} exitEvidence`, 1000),
      baselineChangeApproval: approval ? {
        reviewer: text(approval.reviewer, `${actionId} baseline approval reviewer`, 120),
        decision: approval.decision,
        rationale: text(approval.rationale, `${actionId} baseline approval rationale`, 1000),
        reviewedAt: timestamp(approval.reviewedAt, `${actionId} baseline approval reviewedAt`),
      } : null,
      portfolioItemIds: action.portfolioItemIds,
      sourceEvidenceIds: action.sourceEvidenceIds,
    };
  });
}

export function verifyRoadmapRecovery(runs, scheduleReport, baselineDeliveryReport, recoveryPlanReport, followupDeliveryReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  const context = normalizeSources(scheduleReport, baselineDeliveryReport, recoveryPlanReport, followupDeliveryReport);
  const id = text(input.id, "recovery verification id", 120);
  const asOf = timestamp(input.asOf, "asOf");
  if (asOf < context.followupAsOf) throw new Error("verification asOf cannot precede follow-up evidence");
  const minimumObservationDays = integer(input.minimumObservationDays, "minimumObservationDays", 0, 90);
  const maximumEffortVarianceRate = number(input.maximumEffortVarianceRate, "maximumEffortVarianceRate", 0, 1);
  const outcomes = normalizeOutcomes(input.actionOutcomes, recoveryPlanReport.selectedActions, asOf, maximumEffortVarianceRate);
  const completed = outcomes.filter((outcome) => outcome.status === "completed");
  const latestCompletion = completed.length ? completed.map((outcome) => outcome.completedAt).sort().at(-1) : null;
  const observationDays = latestCompletion ? day(context.followupAsOf) - day(latestCompletion) : 0;
  const restoredCheckIds = [...context.originalFailures].filter((id) => context.followupChecks.get(id).passed);
  const unresolvedCheckIds = [...context.originalFailures].filter((id) => !context.followupChecks.get(id).passed);
  const sourceEvidenceIds = [...new Set(recoveryPlanReport.selectedActions.flatMap((action) => action.sourceEvidenceIds ?? []))];
  const checks = [
    { id: "execution-completeness", passed: completed.length === outcomes.length, detail: `${completed.length} of ${outcomes.length} selected action(s) completed.` },
    { id: "schedule-adherence", passed: outcomes.every((outcome) => outcome.status === "completed" && outcome.onTime), detail: `${outcomes.filter((outcome) => !outcome.onTime).length} action(s) incomplete or late.` },
    { id: "effort-control", passed: outcomes.every((outcome) => outcome.effortWithinTolerance), detail: `${outcomes.filter((outcome) => !outcome.effortWithinTolerance).length} action(s) exceed the declared effort tolerance.` },
    { id: "baseline-governance", passed: outcomes.every((outcome) => !recoveryPlanReport.selectedActions.find((action) => action.id === outcome.actionId).changesBaseline || Boolean(outcome.baselineChangeApproval)), detail: "Every completed baseline-changing action requires prior explicit approval." },
    { id: "observation-maturity", passed: completed.length === outcomes.length && observationDays >= minimumObservationDays, detail: `${observationDays} observed day(s) after latest completion; ${minimumObservationDays} required.` },
    { id: "control-restoration", passed: unresolvedCheckIds.length === 0, detail: `${restoredCheckIds.length} of ${context.originalFailures.size} originally failed control(s) now pass.` },
    { id: "evidence-lineage", passed: sourceEvidenceIds.length > 0 && outcomes.every((outcome) => outcome.executionEvidence && outcome.exitEvidence), detail: "Execution, exit, schedule, delivery, and original customer evidence remain linked." },
  ];
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (reviewedAt < asOf) throw new Error("review cannot precede verification asOf");
  const decision = text(input.review?.decision, "review decision", 30);
  if (!["close", "continue_monitoring", "escalate"].includes(decision))
    throw new Error("review decision is invalid");
  const allPassed = checks.every((check) => check.passed);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourceScheduleId: scheduleReport.id,
    sourceBaselineDeliveryId: baselineDeliveryReport.id,
    sourceRecoveryPlanId: recoveryPlanReport.id,
    sourceFollowupDeliveryId: followupDeliveryReport.id,
    status: decision === "close" ? (allPassed ? "verified_recovery" : "blocked_close") : "action_required",
    summary: {
      actions: outcomes.length,
      completedActions: completed.length,
      lateActions: outcomes.filter((outcome) => !outcome.onTime).length,
      effortExceptions: outcomes.filter((outcome) => !outcome.effortWithinTolerance).length,
      baselineChanges: outcomes.filter((outcome) => outcome.baselineChangeApproval).length,
      originallyFailedControls: context.originalFailures.size,
      restoredControls: restoredCheckIds.length,
      observationDays,
    },
    restoredCheckIds,
    unresolvedCheckIds,
    actionOutcomes: outcomes,
    sourceEvidenceIds,
    checks,
    review: {
      reviewer: text(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: text(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method: "deterministic recovery execution and effectiveness verification against the approved Project 42 action set and a later Project 41 control report; the result does not execute actions, change the baseline, close work automatically, establish root cause, prove causality, predict delivery, or certify EVMS compliance",
  };
}
