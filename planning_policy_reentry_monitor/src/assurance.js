const HOUR = 3_600_000;
function required(value, name, max = 1000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
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
function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}
function number(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${name} must be a finite number`);
  return value;
}
const hoursBetween = (start, end) =>
  (Date.parse(end) - Date.parse(start)) / HOUR;
const check = (id, passed, detail) => ({ id, passed, detail });

function normalizeMonitors(raw, review) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 20)
    throw new Error(`${review.id} requires 2–20 monitors`);
  const ids = new Set();
  const monitors = raw.map((item, index) => {
    const id = required(item.id, `${review.id} monitor ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error(`${review.id} monitor IDs must be unique`);
    ids.add(id);
    const type = required(item.type, `${id} type`, 20);
    if (!["recurrence", "guardrail"].includes(type))
      throw new Error(`${id} type is invalid`);
    const direction = required(item.direction, `${id} direction`, 10);
    if (!["above", "below"].includes(direction))
      throw new Error(`${id} direction is invalid`);
    return {
      id,
      type,
      sourceId: required(item.sourceId, `${id} sourceId`, 80),
      name: required(item.name, `${id} name`, 160),
      direction,
      threshold: number(item.threshold, `${id} threshold`),
    };
  });
  const covered = new Set(
    monitors
      .filter((item) => item.type === "recurrence")
      .map((item) => item.sourceId),
  );
  if (!review.contributingConditions.every((item) => covered.has(item.id)))
    throw new Error(
      `${review.id} requires a recurrence monitor for every contributing condition`,
    );
  if (!monitors.some((item) => item.type === "guardrail"))
    throw new Error(`${review.id} requires at least one guardrail monitor`);
  return monitors;
}
function normalizeStages(raw, trial, maxExposurePercent) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 10)
    throw new Error(`${trial.id} requires 1–10 planned stages`);
  const ids = new Set();
  let previous = 0;
  return raw.map((item, index) => {
    const id = required(item.id, `${trial.id} stage ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error(`${trial.id} stage IDs must be unique`);
    ids.add(id);
    const exposurePercent = integer(
      item.exposurePercent,
      `${id} exposurePercent`,
      1,
      maxExposurePercent,
    );
    if (exposurePercent <= previous)
      throw new Error(`${trial.id} stage exposure must increase`);
    previous = exposurePercent;
    return {
      id,
      exposurePercent,
      minimumHours: integer(item.minimumHours, `${id} minimumHours`, 1, 168),
    };
  });
}
function normalizeObservation(
  raw,
  stage,
  monitors,
  criticalActions,
  minimumSampleSize,
) {
  const id = required(raw.id, `${stage.id} observation id`, 80);
  const observedAt = timestamp(raw.observedAt, `${id} observedAt`);
  if (
    Date.parse(observedAt) < Date.parse(stage.startedAt) ||
    Date.parse(observedAt) > Date.parse(stage.endedAt)
  )
    throw new Error(`${id} must occur within its stage`);
  const metrics = Array.isArray(raw.metrics) ? raw.metrics : [];
  if (metrics.length !== monitors.length)
    throw new Error(`${id} must report every declared monitor`);
  const seen = new Set();
  const normalizedMetrics = metrics.map((item) => {
    const monitorId = required(item.monitorId, `${id} monitorId`, 80);
    if (seen.has(monitorId))
      throw new Error(`${id} monitor values must be unique`);
    seen.add(monitorId);
    const monitor = monitors.find((entry) => entry.id === monitorId);
    if (!monitor) throw new Error(`${id} references an unknown monitor`);
    const value = number(item.value, `${id} ${monitorId} value`);
    const breached =
      monitor.direction === "above"
        ? value > monitor.threshold
        : value < monitor.threshold;
    return {
      monitorId,
      type: monitor.type,
      value,
      threshold: monitor.threshold,
      direction: monitor.direction,
      breached,
      evidence: required(item.evidence, `${id} ${monitorId} evidence`, 1000),
    };
  });
  const controls = Array.isArray(raw.actionControls) ? raw.actionControls : [];
  const controlIds = new Set();
  const actionControls = controls.map((item) => {
    const actionId = required(item.actionId, `${id} actionId`, 80);
    if (controlIds.has(actionId))
      throw new Error(`${id} action controls must be unique`);
    controlIds.add(actionId);
    if (!criticalActions.includes(actionId))
      throw new Error(`${id} references an unknown critical action`);
    return {
      actionId,
      operational: item.operational === true,
      evidence: required(item.evidence, `${id} ${actionId} evidence`, 1000),
    };
  });
  if (!criticalActions.every((actionId) => controlIds.has(actionId)))
    throw new Error(`${id} must report every critical action control`);
  return {
    id,
    observedAt,
    sampleSize: integer(raw.sampleSize, `${id} sampleSize`, 1, 10_000_000),
    sampleSufficient: raw.sampleSize >= minimumSampleSize,
    metrics: normalizedMetrics,
    actionControls,
  };
}
function assess(raw, context) {
  const id = required(raw.id, "re-entry assurance id", 80);
  const incidentLearningReviewId = required(
    raw.incidentLearningReviewId,
    `${id} incidentLearningReviewId`,
    80,
  );
  const learning = context.reviews.get(incidentLearningReviewId);
  if (!learning)
    throw new Error(
      `${id} must reference a Project 38 incident learning review`,
    );
  const declaredAt = timestamp(raw.declaredAt, `${id} declaredAt`);
  const startedAt = timestamp(raw.startedAt, `${id} startedAt`);
  const endedAt = timestamp(raw.endedAt, `${id} endedAt`);
  if (
    Date.parse(declaredAt) < Date.parse(learning.review.reviewedAt) ||
    Date.parse(declaredAt) > Date.parse(startedAt)
  )
    throw new Error(
      `${id} declaration must follow approval and precede exposure`,
    );
  if (
    Date.parse(startedAt) < Date.parse(learning.reentry.startsAt) ||
    Date.parse(endedAt) <= Date.parse(startedAt) ||
    Date.parse(endedAt) > Date.parse(context.asOf)
  )
    throw new Error(`${id} timing is outside the approved re-entry window`);
  const scope = Array.isArray(raw.scope) ? raw.scope : [];
  if (
    !scope.length ||
    new Set(scope).size !== scope.length ||
    scope.some((value) => !learning.reentry.scope.includes(value))
  )
    throw new Error(
      `${id} scope must be a non-empty subset of approved re-entry scope`,
    );
  const monitors = normalizeMonitors(raw.monitors, learning);
  const plannedStages = normalizeStages(
    raw.plannedStages,
    { id },
    context.maximumExposurePercent,
  );
  const criticalActions = learning.actions
    .filter(
      (item) =>
        ["p0", "p1"].includes(item.priority) && item.status === "completed",
    )
    .map((item) => item.id);
  if (
    !Array.isArray(raw.executions) ||
    raw.executions.length !== plannedStages.length
  )
    throw new Error(`${id} must execute every planned stage exactly once`);
  let previousEnd = startedAt;
  const observationIds = new Set();
  const executions = raw.executions.map((item, index) => {
    const plan = plannedStages[index];
    if (item.stageId !== plan.id)
      throw new Error(`${id} execution order must match its plan`);
    const stageStarted = timestamp(item.startedAt, `${plan.id} startedAt`);
    const stageEnded = timestamp(item.endedAt, `${plan.id} endedAt`);
    if (
      Date.parse(stageStarted) < Date.parse(previousEnd) ||
      hoursBetween(previousEnd, stageStarted) > context.maximumStageGapHours ||
      Date.parse(stageEnded) <= Date.parse(stageStarted) ||
      Date.parse(stageEnded) > Date.parse(endedAt)
    )
      throw new Error(`${plan.id} timing is invalid`);
    previousEnd = stageEnded;
    const stage = { id: plan.id, startedAt: stageStarted, endedAt: stageEnded };
    if (
      !Array.isArray(item.observations) ||
      !item.observations.length ||
      item.observations.length > 50
    )
      throw new Error(`${plan.id} requires 1–50 observations`);
    const observations = item.observations.map((value) => {
      const normalized = normalizeObservation(
        value,
        stage,
        monitors,
        criticalActions,
        context.minimumSampleSize,
      );
      if (observationIds.has(normalized.id))
        throw new Error(`${id} observation IDs must be unique`);
      observationIds.add(normalized.id);
      return normalized;
    });
    return {
      stageId: plan.id,
      plannedExposurePercent: plan.exposurePercent,
      observedExposurePercent: integer(
        item.exposurePercent,
        `${plan.id} exposurePercent`,
        1,
        100,
      ),
      minimumHours: plan.minimumHours,
      actualHours: hoursBetween(stageStarted, stageEnded),
      startedAt: stageStarted,
      endedAt: stageEnded,
      evidence: required(item.evidence, `${plan.id} evidence`, 1000),
      observations,
    };
  });
  if (executions.at(-1).endedAt !== endedAt)
    throw new Error(`${id} final stage must end with the declared trial`);
  const observations = executions.flatMap((item) => item.observations);
  const metrics = observations.flatMap((item) => item.metrics);
  const controls = observations.flatMap((item) => item.actionControls);
  const decision = required(raw.review?.decision, `${id} review decision`, 20);
  if (!["continue", "pause", "refreeze"].includes(decision))
    throw new Error(`${id} review decision is invalid`);
  const reviewedAt = timestamp(raw.review?.reviewedAt, `${id} reviewedAt`);
  if (
    Date.parse(reviewedAt) < Date.parse(endedAt) ||
    Date.parse(reviewedAt) > Date.parse(context.asOf)
  )
    throw new Error(`${id} review must follow observation and not exceed asOf`);
  const checks = [
    check(
      "approved-learning",
      learning.status === "ready_for_reentry" &&
        learning.review?.decision === "approve_reentry",
      "Project 38 must approve re-entry.",
    ),
    check(
      "approved-owner-baseline-scope",
      raw.owner === learning.reentry.owner &&
        raw.baselineVersion === learning.reentry.baselineVersion &&
        scope.every((value) => learning.reentry.scope.includes(value)),
      "Owner, baseline, and scope must remain within Project 38 approval.",
    ),
    check(
      "bounded-exposure",
      executions.every(
        (item, index) =>
          item.observedExposurePercent ===
            plannedStages[index].exposurePercent &&
          item.observedExposurePercent <= context.maximumExposurePercent,
      ),
      `Every stage must match its plan and remain at or below ${context.maximumExposurePercent}%.`,
    ),
    check(
      "stage-dwell",
      executions.every((item) => item.actualHours >= item.minimumHours),
      "Every stage must satisfy its declared dwell time.",
    ),
    check(
      "observation-window",
      hoursBetween(startedAt, endedAt) >= context.minimumObservationHours,
      `Observation lasted ${hoursBetween(startedAt, endedAt)} hours; required ${context.minimumObservationHours}.`,
    ),
    check(
      "sample-sufficiency",
      observations.every((item) => item.sampleSufficient),
      `Every observation must include at least ${context.minimumSampleSize} units.`,
    ),
    check(
      "critical-controls-operational",
      criticalActions.length > 0 && controls.every((item) => item.operational),
      "Every completed critical action must remain operational at every observation.",
    ),
    check(
      "no-recurrence-signal",
      metrics
        .filter((item) => item.type === "recurrence")
        .every((item) => !item.breached),
      "No incident recurrence monitor may breach.",
    ),
    check(
      "guardrails-within-threshold",
      metrics
        .filter((item) => item.type === "guardrail")
        .every((item) => !item.breached),
      "Every re-entry guardrail must remain within threshold.",
    ),
  ];
  const allPassed = checks.every((item) => item.passed);
  return {
    id,
    incidentLearningReviewId,
    policyRecoveryReviewId: learning.policyRecoveryReviewId,
    policyEffectivenessReviewId: learning.policyEffectivenessReviewId,
    rolloutId: learning.rolloutId,
    proposalId: learning.proposalId,
    outcomeReviewId: learning.outcomeReviewId,
    experimentId: learning.experimentId,
    policyId: learning.policyId,
    owner: required(raw.owner, `${id} owner`, 120),
    baselineVersion: required(raw.baselineVersion, `${id} baselineVersion`, 40),
    scope,
    declaredAt,
    startedAt,
    endedAt,
    monitors,
    plannedStages,
    executions,
    checks,
    status:
      decision === "continue"
        ? allPassed
          ? "verified_reentry"
          : "blocked_continue"
        : "action_required",
    review: {
      reviewer: required(raw.review.reviewer, `${id} reviewer`, 120),
      decision,
      rationale: required(raw.review.rationale, `${id} rationale`, 1000),
      reviewedAt,
    },
  };
}

export function monitorPlanningPolicyReentry(runs, learningReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  if (
    learningReport?.schemaVersion !== "1.0.0" ||
    !Array.isArray(learningReport.incidentLearningReviews)
  )
    throw new Error("Provide a Project 38 policy re-entry report");
  const asOf = timestamp(input.asOf, "asOf");
  if (Date.parse(learningReport.asOf) > Date.parse(asOf))
    throw new Error("Project 38 report occurs after asOf");
  const minimumObservationHours = integer(
    input.minimumObservationHours,
    "minimumObservationHours",
    1,
    720,
  );
  const maximumStageGapHours = integer(
    input.maximumStageGapHours,
    "maximumStageGapHours",
    0,
    168,
  );
  const maximumExposurePercent = integer(
    input.maximumExposurePercent,
    "maximumExposurePercent",
    1,
    100,
  );
  const minimumSampleSize = integer(
    input.minimumSampleSize,
    "minimumSampleSize",
    1,
    10_000_000,
  );
  if (
    !Array.isArray(input.trials) ||
    !input.trials.length ||
    input.trials.length > 50
  )
    throw new Error("Provide 1–50 re-entry trials");
  const context = {
    asOf,
    minimumObservationHours,
    maximumStageGapHours,
    maximumExposurePercent,
    minimumSampleSize,
    reviews: new Map(
      learningReport.incidentLearningReviews.map((item) => [item.id, item]),
    ),
  };
  const ids = new Set(),
    sources = new Set();
  const trials = input.trials.map((raw) => {
    const id = required(raw.id, "re-entry assurance id", 80);
    if (ids.has(id)) throw new Error("Re-entry assurance IDs must be unique");
    ids.add(id);
    const source = required(
      raw.incidentLearningReviewId,
      `${id} incidentLearningReviewId`,
      80,
    );
    if (sources.has(source))
      throw new Error("Each learning review may have only one assurance trial");
    sources.add(source);
    return assess(raw, context);
  });
  const summary = trials.reduce(
    (result, item) => {
      result[item.status]++;
      return result;
    },
    { verified_reentry: 0, blocked_continue: 0, action_required: 0 },
  );
  return {
    schemaVersion: "1.0.0",
    asOf,
    sourceIncidentLearningReviewIds: trials.map(
      (item) => item.incidentLearningReviewId,
    ),
    sourcePolicyRecoveryReviewIds: trials.map(
      (item) => item.policyRecoveryReviewId,
    ),
    sourcePolicyEffectivenessReviewIds: trials.map(
      (item) => item.policyEffectivenessReviewId,
    ),
    sourcePolicyRolloutIds: trials.map((item) => item.rolloutId),
    status: summary.blocked_continue
      ? "blocked_continue"
      : summary.action_required
        ? "action_required"
        : "verified_reentry",
    summary: { trials: trials.length, ...summary },
    reentryAssuranceTrials: trials,
    method:
      "deterministic Project 38 lineage, pre-exposure declaration, approved owner/baseline/scope, bounded staged exposure, stage dwell, observation-window, sample, corrective-control, recurrence-signal, guardrail, evidence, and named human-decision checks; this monitor never changes policy, expands exposure, pauses or refreezes a trial, assigns blame, or claims causality",
  };
}
