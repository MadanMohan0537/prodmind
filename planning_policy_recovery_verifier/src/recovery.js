const DAY = 86_400_000;
const HOUR = 3_600_000;

function required(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

const daysBetween = (start, end) => Math.floor((Date.parse(end) - Date.parse(start)) / DAY);
const check = (id, passed, detail) => ({id, passed, detail});

function executionSnapshots(raw, reviewId, initiatedAt, asOf) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) throw new Error(`${reviewId} requires 1–20 execution snapshots`);
  const ids = new Set(); let previousTime = Date.parse(initiatedAt) - 1; let previousPercent = -1;
  return raw.map((item, index) => {
    const id = required(item.id, `${reviewId} execution snapshot ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error(`${reviewId} execution snapshot IDs must be unique`); ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`); const time = Date.parse(observedAt);
    if (time < previousTime || time > Date.parse(asOf)) throw new Error(`${reviewId} execution snapshots must follow initiation, be chronological, and not exceed asOf`);
    previousTime = time;
    const percentReverted = integer(item.percentReverted, `${id} percentReverted`, 1, 100);
    if (percentReverted <= previousPercent) throw new Error(`${reviewId} execution percentages must increase`); previousPercent = percentReverted;
    return {id, observedAt, percentReverted, version: required(item.version, `${id} version`, 40), evidence: required(item.evidence, `${id} evidence`, 1000)};
  });
}

function recoverySnapshots(raw, reviewId, completedAt, monitors, asOf) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 24) throw new Error(`${reviewId} requires 2–24 recovery snapshots`);
  const expected = new Map(monitors.map(item => [item.name, item])); const ids = new Set(); let previous = Date.parse(completedAt);
  return raw.map((item, index) => {
    const id = required(item.id, `${reviewId} recovery snapshot ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error(`${reviewId} recovery snapshot IDs must be unique`); ids.add(id);
    const observedAt = timestamp(item.observedAt, `${id} observedAt`); const time = Date.parse(observedAt);
    if (time <= previous || time > Date.parse(asOf)) throw new Error(`${reviewId} recovery snapshots must follow completed reversion, be chronological, and not exceed asOf`);
    previous = time;
    if (!Array.isArray(item.monitorValues) || item.monitorValues.length !== expected.size) throw new Error(`${id} must report every declared monitor`);
    const names = new Set();
    const monitorValues = item.monitorValues.map(value => {
      const name = required(value.name, `${id} monitor name`, 120);
      if (names.has(name) || !expected.has(name)) throw new Error(`${id} monitor values must be unique and declared`); names.add(name);
      return {name, value: finite(value.value, `${id} ${name} value`)};
    });
    return {id, observedAt, version: required(item.version, `${id} version`, 40), monitorValues, evidence: required(item.evidence, `${id} evidence`, 1000)};
  });
}

function assessReview(raw, context) {
  const id = required(raw.id, 'recovery review id', 80);
  const policyEffectivenessReviewId = required(raw.policyEffectivenessReviewId, `${id} policyEffectivenessReviewId`, 80);
  const effectiveness = context.effectiveness.get(policyEffectivenessReviewId);
  if (!effectiveness) throw new Error(`${id} must reference a Project 36 policy effectiveness review`);
  const rollout = context.rollouts.get(effectiveness.rolloutId);
  if (!rollout) throw new Error(`${id} cannot resolve its Project 35 rollout`);
  if (!rollout.rollback || !Array.isArray(rollout.monitors)) throw new Error(`${id} requires Project 35 rollback and monitor controls`);
  const initiatedAt = timestamp(raw.initiatedAt, `${id} initiatedAt`);
  if (Date.parse(initiatedAt) < Date.parse(effectiveness.review.reviewedAt) || Date.parse(initiatedAt) > Date.parse(context.asOf)) throw new Error(`${id} initiation must follow the revert decision and not exceed asOf`);
  const execution = executionSnapshots(raw.executionSnapshots, id, initiatedAt, context.asOf);
  const completedAt = execution.at(-1).observedAt;
  const recovery = recoverySnapshots(raw.recoverySnapshots, id, completedAt, rollout.monitors, context.asOf);
  const decision = required(raw.review?.decision, `${id} review decision`, 30);
  if (!['close_reversion', 'continue_monitoring', 'escalate'].includes(decision)) throw new Error(`${id} review decision is invalid`);
  const reviewedAt = timestamp(raw.review?.reviewedAt, `${id} review reviewedAt`);
  if (Date.parse(reviewedAt) < Date.parse(recovery.at(-1).observedAt) || Date.parse(reviewedAt) > Date.parse(context.asOf)) throw new Error(`${id} review must follow recovery snapshots and not exceed asOf`);
  const targetVersion = rollout.rollback.targetVersion;
  const decisionHours = (Date.parse(initiatedAt) - Date.parse(effectiveness.review.reviewedAt)) / HOUR;
  const recoveryDays = daysBetween(completedAt, context.asOf);
  const cadenceTimes = [completedAt, ...recovery.map(item => item.observedAt), context.asOf];
  const gaps = cadenceTimes.slice(1).map((value, index) => daysBetween(cadenceTimes[index], value));
  const monitorChecks = recovery.flatMap(snapshot => snapshot.monitorValues.map(value => {
    const monitor = rollout.monitors.find(item => item.name === value.name);
    const passed = monitor.direction === 'above' ? value.value <= monitor.threshold : value.value >= monitor.threshold;
    return {snapshotId: snapshot.id, name: value.name, value: value.value, threshold: monitor.threshold, direction: monitor.direction, passed};
  }));
  const checks = [
    check('authorized-revert', effectiveness.review.decision === 'revert' && effectiveness.status === 'action_required', 'Project 36 must record a named human revert decision.'),
    check('initiation-sla', decisionHours <= rollout.rollback.maximumDecisionHours, `Reversion began in ${decisionHours} hours; allowed ${rollout.rollback.maximumDecisionHours}.`),
    check('execution-complete', execution.at(-1).percentReverted === 100, 'Execution evidence must reach 100% of approved scope.'),
    check('rollback-target', [...execution, ...recovery].every(item => item.version === targetVersion), `Every snapshot must observe rollback target ${targetVersion}.`),
    check('recovery-window', recoveryDays >= context.minimumRecoveryDays, `Observed ${recoveryDays} recovery days; required ${context.minimumRecoveryDays}.`),
    check('recovery-cadence', gaps.every(gap => gap <= context.maximumSnapshotGapDays), `Every recovery gap must be at most ${context.maximumSnapshotGapDays} days.`),
    check('monitor-recovery', monitorChecks.every(item => item.passed), 'Every declared monitor must remain within its approved recovery threshold.'),
    check('evidence-complete', [...execution, ...recovery].every(item => Boolean(item.evidence)), 'Every execution and recovery snapshot includes reviewable evidence.'),
  ];
  const allPassed = checks.every(item => item.passed);
  return {
    id, policyEffectivenessReviewId, rolloutId: rollout.id, proposalId: rollout.proposalId,
    outcomeReviewId: rollout.outcomeReviewId, experimentId: effectiveness.experimentId,
    policyId: rollout.policyId, fromVersion: rollout.toVersion, recoveredVersion: targetVersion,
    scope: rollout.scope, initiatedAt, decisionHours, recoveryDays,
    executionSnapshots: execution, recoverySnapshots: recovery, monitorChecks, checks,
    status: decision === 'close_reversion' ? (allPassed ? 'verified_recovery' : 'blocked_close') : 'action_required',
    review: {reviewer: required(raw.review.reviewer, `${id} review reviewer`, 120), decision, rationale: required(raw.review.rationale, `${id} review rationale`, 1000), reviewedAt},
  };
}

export function verifyPlanningPolicyRecovery(runs, effectivenessReport, rolloutReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (effectivenessReport?.schemaVersion !== '1.0.0' || !Array.isArray(effectivenessReport.policyReviews)) throw new Error('Provide a Project 36 planning policy effectiveness report');
  if (rolloutReport?.schemaVersion !== '1.0.0' || !Array.isArray(rolloutReport.rollouts)) throw new Error('Provide a Project 35 planning policy rollout report');
  const asOf = timestamp(input.asOf, 'asOf');
  if ([effectivenessReport.asOf, rolloutReport.asOf].some(value => Date.parse(value) > Date.parse(asOf))) throw new Error('An upstream report occurs after asOf');
  const minimumRecoveryDays = integer(input.minimumRecoveryDays, 'minimumRecoveryDays', 1, 90);
  const maximumSnapshotGapDays = integer(input.maximumSnapshotGapDays, 'maximumSnapshotGapDays', 1, 30);
  if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 50) throw new Error('Provide 1–50 planning policy recovery reviews');
  const context = {asOf, minimumRecoveryDays, maximumSnapshotGapDays, effectiveness: new Map(effectivenessReport.policyReviews.map(item => [item.id, item])), rollouts: new Map(rolloutReport.rollouts.map(item => [item.id, item]))};
  const ids = new Set(); const sources = new Set();
  const reviews = input.reviews.map(raw => {
    const id = required(raw.id, 'recovery review id', 80); if (ids.has(id)) throw new Error('Recovery review IDs must be unique'); ids.add(id);
    const source = required(raw.policyEffectivenessReviewId, `${id} policyEffectivenessReviewId`, 80); if (sources.has(source)) throw new Error('Each effectiveness review may have only one recovery review'); sources.add(source);
    return assessReview(raw, context);
  });
  const summary = reviews.reduce((result, item) => { result[item.status]++; return result; }, {verified_recovery: 0, blocked_close: 0, action_required: 0});
  return {
    schemaVersion: '1.0.0', asOf,
    sourcePolicyEffectivenessReviewIds: reviews.map(item => item.policyEffectivenessReviewId),
    sourcePolicyRolloutIds: reviews.map(item => item.rolloutId), sourcePolicyChangeIds: reviews.map(item => item.proposalId),
    sourceOutcomeReviewIds: reviews.map(item => item.outcomeReviewId), sourcePolicyExperimentIds: reviews.map(item => item.experimentId),
    status: summary.blocked_close ? 'blocked_close' : summary.action_required ? 'action_required' : 'verified_recovery',
    summary: {reviews: reviews.length, ...summary}, policyRecoveryReviews: reviews,
    method: 'deterministic revert-authorization, decision-SLA, execution-completeness, target-version, recovery-window, cadence, monitor-threshold, and evidence checks; this verifier never executes a reversion, changes policy, or proves causality',
  };
}
