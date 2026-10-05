const DAY = 86_400_000;

function required(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters`);
  }
  return value.trim();
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

const daysBetween = (start, end) => Math.floor((Date.parse(end) - Date.parse(start)) / DAY);
const check = (id, passed, detail) => ({id, passed, detail});

function measuresPass(experiment, observation) {
  const primaryPassed = experiment.primaryMeasure.direction === 'increase'
    ? observation.observedPrimary >= experiment.primaryMeasure.target
    : observation.observedPrimary <= experiment.primaryMeasure.target;
  const boundary = experiment.guardrailMeasure.direction === 'not_increase'
    ? experiment.guardrailMeasure.baseline + experiment.guardrailMeasure.tolerance
    : experiment.guardrailMeasure.baseline - experiment.guardrailMeasure.tolerance;
  const guardrailPassed = experiment.guardrailMeasure.direction === 'not_increase'
    ? observation.observedGuardrail <= boundary
    : observation.observedGuardrail >= boundary;
  return {primaryPassed, guardrailPassed, guardrailBoundary: boundary};
}

function normalizeObservations(raw, context) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 24) {
    throw new Error(`${context.reviewId} requires 2–24 effectiveness observations`);
  }
  const ids = new Set();
  let previous = Date.parse(context.rolloutCompletedAt);
  return raw.map((item, index) => {
    const id = required(item.id, `${context.reviewId} observation ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error(`${context.reviewId} observation IDs must be unique`);
    ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`);
    const time = Date.parse(observedAt);
    if (time <= previous || time > Date.parse(context.asOf)) {
      throw new Error(`${context.reviewId} observations must follow rollout completion, be chronological, and not exceed asOf`);
    }
    previous = time;
    const observation = {
      id,
      observedAt,
      version: required(item.version, `${id} version`, 40),
      sampleSize: integer(item.sampleSize, `${id} sampleSize`, 0, 1_000_000_000),
      observedPrimary: finite(item.observedPrimary, `${id} observedPrimary`),
      observedGuardrail: finite(item.observedGuardrail, `${id} observedGuardrail`),
      evidence: required(item.evidence, `${id} evidence`, 1000),
    };
    return {...observation, ...measuresPass(context.experiment, observation)};
  });
}

function assessReview(raw, context) {
  const id = required(raw.id, 'effectiveness review id', 80);
  const rolloutId = required(raw.rolloutId, `${id} rolloutId`, 80);
  const rollout = context.rollouts.get(rolloutId);
  if (!rollout) throw new Error(`${id} must reference a Project 35 rollout`);
  const outcome = context.outcomes.get(rollout.outcomeReviewId);
  if (!outcome) throw new Error(`${id} cannot resolve its Project 33 outcome review`);
  const experiment = context.experiments.get(outcome.experimentId);
  if (!experiment) throw new Error(`${id} cannot resolve its predeclared Project 32 measures`);
  const rolloutCompletedAt = rollout.snapshots.at(-1)?.observedAt;
  if (!rolloutCompletedAt) throw new Error(`${id} requires Project 35 rollout snapshots`);
  const observations = normalizeObservations(raw.observations, {...context, reviewId: id, rolloutCompletedAt, experiment});
  const decision = required(raw.review?.decision, `${id} review decision`, 20);
  if (!['retain', 'adjust', 'revert'].includes(decision)) throw new Error(`${id} review decision is invalid`);
  const reviewedAt = timestamp(raw.review?.reviewedAt, `${id} review reviewedAt`);
  if (Date.parse(reviewedAt) < Date.parse(observations.at(-1).observedAt) || Date.parse(reviewedAt) > Date.parse(context.asOf)) {
    throw new Error(`${id} review must follow observations and not exceed asOf`);
  }
  const timestamps = [rolloutCompletedAt, ...observations.map(item => item.observedAt), context.asOf];
  const gaps = timestamps.slice(1).map((value, index) => daysBetween(timestamps[index], value));
  const sustainmentDays = daysBetween(rolloutCompletedAt, context.asOf);
  const checks = [
    check('verified-rollout', rollout.status === 'verified_rollout' && rollout.review?.decision === 'continue', 'Project 35 must verify the completed rollout.'),
    check('verified-adoption-lineage', outcome.status === 'verified_adopt' && outcome.review?.decision === 'adopt', 'The rollout must retain a verified Project 33 adoption decision.'),
    check('sustainment-window', sustainmentDays >= context.minimumSustainmentDays, `Observed ${sustainmentDays} days; required ${context.minimumSustainmentDays}.`),
    check('observation-cadence', gaps.every(gap => gap <= context.maximumSnapshotGapDays), `Every observation gap must be at most ${context.maximumSnapshotGapDays} days.`),
    check('target-version', observations.every(item => item.version === rollout.toVersion), `Every observation must use policy version ${rollout.toVersion}.`),
    check('sample-size', observations.every(item => item.sampleSize >= experiment.minimumSampleSize), `Every observation must include at least ${experiment.minimumSampleSize} samples.`),
    check('primary-sustained', observations.every(item => item.primaryPassed), `Every observation must sustain the predeclared ${experiment.primaryMeasure.name} target.`),
    check('guardrail-sustained', observations.every(item => item.guardrailPassed), `Every observation must satisfy the predeclared ${experiment.guardrailMeasure.name} guardrail.`),
    check('evidence-complete', observations.every(item => Boolean(item.evidence)), 'Every observation includes reviewable evidence.'),
  ];
  const allPassed = checks.every(item => item.passed);
  const first = observations[0];
  const latest = observations.at(-1);
  return {
    id,
    rolloutId,
    proposalId: rollout.proposalId,
    outcomeReviewId: outcome.id,
    experimentId: experiment.id,
    policyId: rollout.policyId,
    policyVersion: rollout.toVersion,
    predeclaredMeasures: {
      primary: experiment.primaryMeasure,
      guardrail: experiment.guardrailMeasure,
      minimumSampleSize: experiment.minimumSampleSize,
    },
    sustainmentDays,
    observations,
    drift: {
      primaryChange: latest.observedPrimary - first.observedPrimary,
      guardrailChange: latest.observedGuardrail - first.observedGuardrail,
      targetRegressionDetected: observations.some(item => !item.primaryPassed),
      guardrailRegressionDetected: observations.some(item => !item.guardrailPassed),
    },
    checks,
    status: decision === 'retain' ? (allPassed ? 'sustained_effectiveness' : 'blocked_retain') : 'action_required',
    review: {
      reviewer: required(raw.review.reviewer, `${id} review reviewer`, 120),
      decision,
      rationale: required(raw.review.rationale, `${id} review rationale`, 1000),
      reviewedAt,
    },
  };
}

export function monitorPlanningPolicyEffectiveness(runs, rolloutReport, policyPlan, outcomeReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (rolloutReport?.schemaVersion !== '1.0.0' || !Array.isArray(rolloutReport.rollouts)) {
    throw new Error('Provide a Project 35 planning policy rollout report');
  }
  if (policyPlan?.schemaVersion !== '1.0.0' || !Array.isArray(policyPlan.selectedExperiments)) {
    throw new Error('Provide a Project 32 planning policy experiment plan');
  }
  if (outcomeReport?.schemaVersion !== '1.0.0' || !Array.isArray(outcomeReport.outcomes)) {
    throw new Error('Provide a Project 33 planning policy outcome report');
  }
  const asOf = timestamp(input.asOf, 'asOf');
  if ([rolloutReport.asOf, policyPlan.asOf, outcomeReport.asOf].some(value => Date.parse(value) > Date.parse(asOf))) {
    throw new Error('An upstream report occurs after asOf');
  }
  const minimumSustainmentDays = integer(input.minimumSustainmentDays, 'minimumSustainmentDays', 7, 365);
  const maximumSnapshotGapDays = integer(input.maximumSnapshotGapDays, 'maximumSnapshotGapDays', 1, 90);
  if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 50) {
    throw new Error('Provide 1–50 planning policy effectiveness reviews');
  }
  const context = {
    asOf,
    minimumSustainmentDays,
    maximumSnapshotGapDays,
    rollouts: new Map(rolloutReport.rollouts.map(item => [item.id, item])),
    experiments: new Map(policyPlan.selectedExperiments.map(item => [item.id, item])),
    outcomes: new Map(outcomeReport.outcomes.map(item => [item.id, item])),
  };
  const ids = new Set();
  const rolloutIds = new Set();
  const reviews = input.reviews.map(raw => {
    const id = required(raw.id, 'effectiveness review id', 80);
    if (ids.has(id)) throw new Error('Effectiveness review IDs must be unique');
    ids.add(id);
    const rolloutId = required(raw.rolloutId, `${id} rolloutId`, 80);
    if (rolloutIds.has(rolloutId)) throw new Error('Each rollout may have only one effectiveness review');
    rolloutIds.add(rolloutId);
    return assessReview(raw, context);
  });
  const summary = reviews.reduce((result, review) => {
    result[review.status]++;
    return result;
  }, {sustained_effectiveness: 0, blocked_retain: 0, action_required: 0});
  return {
    schemaVersion: '1.0.0',
    asOf,
    sourcePolicyRolloutAsOf: rolloutReport.asOf,
    sourcePolicyRolloutIds: reviews.map(item => item.rolloutId),
    sourcePolicyChangeIds: reviews.map(item => item.proposalId),
    sourceOutcomeReviewIds: reviews.map(item => item.outcomeReviewId),
    sourcePolicyExperimentIds: reviews.map(item => item.experimentId),
    status: summary.blocked_retain ? 'blocked_retain' : summary.action_required ? 'action_required' : 'sustained_effectiveness',
    summary: {reviews: reviews.length, ...summary},
    policyReviews: reviews,
    method: 'deterministic sustainment-window, observation-cadence, version, sample, predeclared-target, guardrail, drift, and evidence checks; this monitor does not prove causality or retain, adjust, or revert a policy',
  };
}
