const required = (value, name, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters`);
  }
  return value.trim();
};

const timestamp = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
};

const finite = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
};

const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
};

const check = (id, passed, detail) => ({id, passed, detail});

function verifyReview(raw, experiment, asOf) {
  const id = required(raw.id, 'review id', 80);
  const completedAt = timestamp(raw.completedAt, `${id} completedAt`);
  const reviewedAt = timestamp(raw.review?.reviewedAt, `${id} reviewedAt`);
  if (Date.parse(reviewedAt) > Date.parse(asOf)) throw new Error(`${id} review cannot occur after asOf`);
  if (Date.parse(reviewedAt) < Date.parse(completedAt)) throw new Error(`${id} review cannot precede completion`);
  const decision = required(raw.review?.decision, `${id} decision`, 20);
  if (!['adopt', 'extend', 'rollback'].includes(decision)) throw new Error(`${id} decision is invalid`);
  const sampleSize = integer(raw.sampleSize, `${id} sampleSize`, 0, 1_000_000_000);
  const observedPrimary = finite(raw.observedPrimary, `${id} observedPrimary`);
  const observedGuardrail = finite(raw.observedGuardrail, `${id} observedGuardrail`);
  const elapsedDays = Math.floor((Date.parse(asOf) - Date.parse(experiment.startsAt)) / 86_400_000);
  const primaryPassed = experiment.primaryMeasure.direction === 'increase'
    ? observedPrimary >= experiment.primaryMeasure.target
    : observedPrimary <= experiment.primaryMeasure.target;
  const guardrailLimit = experiment.guardrailMeasure.direction === 'not_increase'
    ? experiment.guardrailMeasure.baseline + experiment.guardrailMeasure.tolerance
    : experiment.guardrailMeasure.baseline - experiment.guardrailMeasure.tolerance;
  const guardrailPassed = experiment.guardrailMeasure.direction === 'not_increase'
    ? observedGuardrail <= guardrailLimit
    : observedGuardrail >= guardrailLimit;
  const deliveryEvidence = required(raw.deliveryEvidence, `${id} deliveryEvidence`, 1000);
  const analysisEvidence = required(raw.analysisEvidence, `${id} analysisEvidence`, 1000);
  const checks = [
    check('experiment-timing', Date.parse(completedAt) >= Date.parse(experiment.startsAt) && Date.parse(completedAt) <= Date.parse(asOf), 'Completion must fall between the planned start and assessment date.'),
    check('observation-window', Date.parse(asOf) >= Date.parse(experiment.reviewAt) && elapsedDays >= experiment.minimumObservationDays, `Observed ${elapsedDays} days; required ${experiment.minimumObservationDays}.`),
    check('sample-size', sampleSize >= experiment.minimumSampleSize, `Observed ${sampleSize}; required ${experiment.minimumSampleSize}.`),
    check('primary-target', primaryPassed, `Observed ${observedPrimary} ${experiment.primaryMeasure.unit}; target ${experiment.primaryMeasure.direction} to ${experiment.primaryMeasure.target}.`),
    check('guardrail', guardrailPassed, `Observed ${observedGuardrail} ${experiment.guardrailMeasure.unit}; permitted boundary ${guardrailLimit}.`),
    check('evidence-complete', Boolean(deliveryEvidence && analysisEvidence), 'Delivery and analysis evidence are recorded.'),
  ];
  const allPassed = checks.every(item => item.passed);
  return {
    id,
    experimentId: experiment.id,
    completedAt,
    sampleSize,
    observedPrimary,
    observedGuardrail,
    deliveryEvidence,
    analysisEvidence,
    checks,
    status: decision === 'adopt' ? (allPassed ? 'verified_adopt' : 'blocked_adopt') : 'action_required',
    review: {
      reviewer: required(raw.review.reviewer, `${id} reviewer`, 120),
      decision,
      rationale: required(raw.review.rationale, `${id} rationale`, 1000),
      reviewedAt,
    },
  };
}

export function verifyPolicyExperimentOutcomes(runs, policyPlan, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (policyPlan?.schemaVersion !== '1.0.0' || !Array.isArray(policyPlan.selectedExperiments)) {
    throw new Error('Provide a Project 32 planning policy experiment plan');
  }
  if (policyPlan.status !== 'approved') throw new Error('Project 32 plan must be approved before outcome verification');
  const asOf = timestamp(input.asOf, 'asOf');
  if (Date.parse(policyPlan.asOf) > Date.parse(asOf)) throw new Error('Project 32 plan occurs after asOf');
  if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 100) {
    throw new Error('Provide 1–100 policy experiment outcome reviews');
  }
  const experiments = new Map(policyPlan.selectedExperiments.map(experiment => [experiment.id, experiment]));
  const reviewIds = new Set();
  const experimentIds = new Set();
  const outcomes = input.reviews.map(raw => {
    const reviewId = required(raw.id, 'review id', 80);
    if (reviewIds.has(reviewId)) throw new Error('Review IDs must be unique');
    reviewIds.add(reviewId);
    const experimentId = required(raw.experimentId, `${reviewId} experimentId`, 80);
    if (experimentIds.has(experimentId)) throw new Error('Each selected experiment may have only one outcome review');
    experimentIds.add(experimentId);
    const experiment = experiments.get(experimentId);
    if (!experiment) throw new Error(`${reviewId} must reference a selected Project 32 experiment`);
    return verifyReview(raw, experiment, asOf);
  });
  const counts = outcomes.reduce((result, outcome) => {
    result[outcome.status]++;
    return result;
  }, {verified_adopt: 0, blocked_adopt: 0, action_required: 0});
  return {
    schemaVersion: '1.0.0',
    asOf,
    sourcePolicyPlanAsOf: policyPlan.asOf,
    sourceOutcomeReviewIds: [...(policyPlan.sourceOutcomeReviewIds ?? [])],
    sourcePolicyExperimentIds: policyPlan.selectedExperiments.map(experiment => experiment.id),
    status: counts.blocked_adopt ? 'blocked_adopt' : counts.action_required ? 'action_required' : 'verified_adopt',
    summary: {reviews: outcomes.length, ...counts},
    outcomes,
    method: 'deterministic verification against predeclared primary target, guardrail, sample size, timing, observation window, and evidence; only a named human may adopt, extend, or roll back a planning policy',
  };
}

