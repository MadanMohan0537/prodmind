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

const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
};

const round = value => Number(value.toFixed(4));
const daysBetween = (left, right) => (Date.parse(right) - Date.parse(left)) / 86_400_000;

export function monitorImprovementOutcomes(runs, improvementReport, recurrenceReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (improvementReport?.schemaVersion !== '1.0.0' || !Array.isArray(improvementReport.selectedActions)) {
    throw new Error('Provide a Project 29 improvement report');
  }
  if (recurrenceReport?.schemaVersion !== '1.0.0' || !Array.isArray(recurrenceReport.surveillance)) {
    throw new Error('Provide a later Project 28 recurrence report');
  }
  if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 50) {
    throw new Error('Provide 1–50 improvement outcome reviews');
  }
  if (typeof input.maximumEffortVarianceRate !== 'number'
      || input.maximumEffortVarianceRate < 0
      || input.maximumEffortVarianceRate > 5) {
    throw new Error('maximumEffortVarianceRate must be from 0 to 5');
  }

  const actions = new Map(improvementReport.selectedActions.map(item => [item.id, item]));
  const targets = new Map(improvementReport.coveredTargets.map(item => [item.id, item]));
  const surveillance = new Map(recurrenceReport.surveillance.map(item => [item.id, item]));
  const ids = new Set();
  const reviews = [];

  for (const [index, raw] of input.reviews.entries()) {
    const id = required(raw.id, `Review ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error('Outcome review IDs must be unique');
    ids.add(id);
    const improvementActionId = required(raw.improvementActionId, `${id} improvementActionId`, 80);
    const action = actions.get(improvementActionId);
    if (!action) throw new Error(`Unknown selected improvement action: ${improvementActionId}`);
    const actionTargets = action.covers.map(targetId => targets.get(targetId));
    if (actionTargets.some(target => !target)) throw new Error(`${id} action has broken Project 29 target lineage`);
    const asOf = timestamp(raw.asOf, `${id} asOf`);
    const completedAt = timestamp(raw.completedAt, `${id} completedAt`);
    if (Date.parse(completedAt) > Date.parse(asOf)) throw new Error(`${id} completion cannot occur after asOf`);
    const actualEffort = integer(raw.actualEffort, `${id} actualEffort`, 1, 1000);
    const minimumFollowups = integer(raw.minimumFollowups, `${id} minimumFollowups`, 1, 12);
    if (!Array.isArray(raw.followupSurveillanceIds)
        || !raw.followupSurveillanceIds.length
        || raw.followupSurveillanceIds.length > 12
        || new Set(raw.followupSurveillanceIds).size !== raw.followupSurveillanceIds.length) {
      throw new Error(`${id} followupSurveillanceIds must contain 1–12 unique IDs`);
    }
    const followups = raw.followupSurveillanceIds.map(value => {
      const followup = surveillance.get(required(value, `${id} followup surveillance ID`, 80));
      if (!followup) throw new Error(`Unknown follow-up surveillance: ${value}`);
      if (Date.parse(followup.asOf) <= Date.parse(completedAt) || Date.parse(followup.asOf) > Date.parse(asOf)) {
        throw new Error(`${id} follow-ups must occur after completion and not exceed asOf`);
      }
      return followup;
    }).sort((left, right) => Date.parse(left.asOf) - Date.parse(right.asOf));

    const targetKeys = new Set(actionTargets.map(target => `${target.governancePackId}:${target.portfolioItemId}:${target.exitReviewId}`));
    const followupResults = followups.map(item => ({
      surveillanceId: item.id,
      asOf: item.asOf,
      lineageMatch: targetKeys.has(`${item.governancePackId}:${item.portfolioItemId}:${item.exitReviewId}`),
      stable: item.status === 'stable' && item.recurrenceCount === 0 && item.failedChecks.length === 0,
      recurrenceCount: item.recurrenceCount,
      failedChecks: [...item.failedChecks],
    }));
    const latestFollowupAt = followups.at(-1).asOf;
    const observedDays = daysBetween(completedAt, latestFollowupAt);
    const effortVarianceRate = round((actualEffort - action.effort) / action.effort);
    const rawDecision = raw.review ?? {};
    const decision = required(rawDecision.decision, `${id} decision`, 20);
    if (!['close', 'continue', 'escalate'].includes(decision)) throw new Error(`${id} decision is invalid`);
    const review = {
      reviewer: required(rawDecision.reviewer, `${id} reviewer`, 120),
      decision,
      rationale: required(rawDecision.rationale, `${id} rationale`, 1000),
      reviewedAt: timestamp(rawDecision.reviewedAt, `${id} reviewedAt`),
    };
    if (Date.parse(review.reviewedAt) > Date.parse(asOf)) throw new Error(`${id} review cannot occur after asOf`);

    const checks = [
      {id: 'plan-approved', passed: improvementReport.status === 'approved', detail: improvementReport.status},
      {id: 'delivery-evidence', passed: Boolean(required(raw.deliveryEvidence, `${id} deliveryEvidence`, 1000)), detail: 'supplied'},
      {id: 'success-evidence', passed: Boolean(required(raw.successEvidence, `${id} successEvidence`, 1000)), detail: action.successMetric},
      {id: 'completed-on-time', passed: Date.parse(completedAt) <= Date.parse(action.dueAt), detail: `completed ${completedAt}; due ${action.dueAt}`},
      {id: 'effort-within-tolerance', passed: effortVarianceRate <= input.maximumEffortVarianceRate, detail: `${effortVarianceRate} variance; allowed ${input.maximumEffortVarianceRate}`},
      {id: 'followup-coverage', passed: followups.length >= minimumFollowups, detail: `${followups.length}/${minimumFollowups}`},
      {id: 'lineage-continuity', passed: followupResults.every(item => item.lineageMatch), detail: `${followupResults.filter(item => item.lineageMatch).length}/${followupResults.length}`},
      {id: 'verification-window', passed: observedDays >= action.verificationWindowDays, detail: `${observedDays}/${action.verificationWindowDays} days`},
      {id: 'recurrence-reduced', passed: followupResults.every(item => item.stable), detail: `${followupResults.filter(item => item.stable).length}/${followupResults.length} stable`},
    ];
    const failedChecks = checks.filter(check => !check.passed).map(check => check.id);
    const status = decision === 'close'
      ? (failedChecks.length ? 'blocked_close' : 'verified_effective')
      : 'action_required';
    reviews.push({
      id,
      improvementActionId,
      title: action.title,
      owner: action.owner,
      response: action.response,
      plannedEffort: action.effort,
      actualEffort,
      effortVarianceRate,
      completedAt,
      dueAt: action.dueAt,
      successMetric: action.successMetric,
      verificationWindowDays: action.verificationWindowDays,
      observedDays,
      asOf,
      evidenceIds: [...new Set(actionTargets.flatMap(target => target.evidenceIds ?? []))],
      portfolioItemIds: [...new Set(actionTargets.map(target => target.portfolioItemId))],
      sourceSurveillanceIds: actionTargets.map(target => target.id),
      followups: followupResults,
      deliveryEvidence: raw.deliveryEvidence.trim(),
      successEvidence: raw.successEvidence.trim(),
      review,
      checks,
      failedChecks,
      status,
    });
  }

  return {
    schemaVersion: '1.0.0',
    maximumEffortVarianceRate: input.maximumEffortVarianceRate,
    summary: {
      reviews: reviews.length,
      verifiedEffective: reviews.filter(item => item.status === 'verified_effective').length,
      blockedClose: reviews.filter(item => item.status === 'blocked_close').length,
      actionRequired: reviews.filter(item => item.status === 'action_required').length,
      recurrences: reviews.reduce((sum, item) => sum + item.followups.reduce((count, followup) => count + followup.recurrenceCount, 0), 0),
    },
    reviews,
    method: 'deterministic approved-plan, delivery, schedule, effort, lineage, observation-window, and later-recurrence checks; the report never closes work or changes a control',
  };
}

