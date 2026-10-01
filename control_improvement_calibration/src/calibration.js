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

const boundedRate = (value, name, max = 1) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${name} must be from 0 to ${max}`);
  }
  return value;
};

const round = value => Number(value.toFixed(4));
const passed = (review, id) => review.checks?.find(check => check.id === id)?.passed === true;

function metrics(items) {
  const planned = items.reduce((sum, item) => sum + item.plannedEffort, 0);
  const actual = items.reduce((sum, item) => sum + item.actualEffort, 0);
  const recurrenceItems = items.filter(item => item.followups.some(followup => followup.recurrenceCount > 0) || !passed(item, 'recurrence-reduced')).length;
  return {
    sampleSize: items.length,
    plannedEffort: planned,
    actualEffort: actual,
    effortBiasRate: planned ? round((actual - planned) / planned) : 0,
    meanAbsoluteEffortErrorRate: items.length ? round(items.reduce((sum, item) => sum + Math.abs(item.actualEffort - item.plannedEffort) / item.plannedEffort, 0) / items.length) : 0,
    onTimeRate: items.length ? round(items.filter(item => passed(item, 'completed-on-time')).length / items.length) : 0,
    effectivenessRate: items.length ? round(items.filter(item => item.status === 'verified_effective').length / items.length) : 0,
    recurrenceRate: items.length ? round(recurrenceItems / items.length) : 0,
    observationCompleteRate: items.length ? round(items.filter(item => passed(item, 'verification-window')).length / items.length) : 0,
    evidenceCoverageRate: items.length ? round(items.filter(item => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0).length / items.length) : 0,
  };
}

export function calibrateImprovementPortfolio(runs, outcomeReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (outcomeReport?.schemaVersion !== '1.0.0' || !Array.isArray(outcomeReport.reviews)) {
    throw new Error('Provide a Project 30 improvement outcome report');
  }
  if (!outcomeReport.reviews.length || outcomeReport.reviews.length > 100) {
    throw new Error('Project 30 report must contain 1–100 reviews');
  }
  if (!Number.isInteger(input.minimumSampleSize) || input.minimumSampleSize < 1 || input.minimumSampleSize > 100) {
    throw new Error('minimumSampleSize must be an integer from 1 to 100');
  }
  const asOf = timestamp(input.asOf, 'asOf');
  const thresholds = {
    maximumAbsoluteEffortBiasRate: boundedRate(input.maximumAbsoluteEffortBiasRate, 'maximumAbsoluteEffortBiasRate', 5),
    minimumOnTimeRate: boundedRate(input.minimumOnTimeRate, 'minimumOnTimeRate'),
    minimumEffectivenessRate: boundedRate(input.minimumEffectivenessRate, 'minimumEffectivenessRate'),
    maximumRecurrenceRate: boundedRate(input.maximumRecurrenceRate, 'maximumRecurrenceRate'),
  };
  const ids = new Set();
  for (const review of outcomeReport.reviews) {
    if (!review?.id || ids.has(review.id)) throw new Error('Project 30 review IDs must be present and unique');
    ids.add(review.id);
    if (!Number.isFinite(review.plannedEffort) || review.plannedEffort <= 0 || !Number.isFinite(review.actualEffort) || review.actualEffort <= 0) {
      throw new Error(`${review.id} must contain positive planned and actual effort`);
    }
    if (!['prevent', 'detect', 'govern'].includes(review.response)) throw new Error(`${review.id} response is invalid`);
    if (!Array.isArray(review.checks) || !Array.isArray(review.followups)) throw new Error(`${review.id} must contain Project 30 checks and follow-ups`);
    if (Date.parse(review.asOf) > Date.parse(asOf)) throw new Error(`${review.id} occurs after calibration asOf`);
  }
  const portfolio = metrics(outcomeReport.reviews);
  const byResponse = ['prevent', 'detect', 'govern'].map(response => {
    const responseItems = outcomeReport.reviews.filter(item => item.response === response);
    return {response, ...metrics(responseItems)};
  });
  const rawReview = input.review ?? {};
  const decision = required(rawReview.decision, 'review decision', 30);
  if (!['accept_baseline', 'adjust_planning', 'collect_more'].includes(decision)) throw new Error('review decision is invalid');
  const review = {
    reviewer: required(rawReview.reviewer, 'review reviewer', 120),
    decision,
    rationale: required(rawReview.rationale, 'review rationale', 1000),
    reviewedAt: timestamp(rawReview.reviewedAt, 'review reviewedAt'),
  };
  if (Date.parse(review.reviewedAt) > Date.parse(asOf)) throw new Error('review cannot occur after asOf');
  const checks = [
    {id:'sample-size',passed:portfolio.sampleSize >= input.minimumSampleSize,detail:`${portfolio.sampleSize}/${input.minimumSampleSize}`},
    {id:'effort-bias',passed:Math.abs(portfolio.effortBiasRate) <= thresholds.maximumAbsoluteEffortBiasRate,detail:`${portfolio.effortBiasRate}; allowed ±${thresholds.maximumAbsoluteEffortBiasRate}`},
    {id:'on-time-delivery',passed:portfolio.onTimeRate >= thresholds.minimumOnTimeRate,detail:`${portfolio.onTimeRate}; minimum ${thresholds.minimumOnTimeRate}`},
    {id:'observed-effectiveness',passed:portfolio.effectivenessRate >= thresholds.minimumEffectivenessRate,detail:`${portfolio.effectivenessRate}; minimum ${thresholds.minimumEffectivenessRate}`},
    {id:'recurrence-rate',passed:portfolio.recurrenceRate <= thresholds.maximumRecurrenceRate,detail:`${portfolio.recurrenceRate}; maximum ${thresholds.maximumRecurrenceRate}`},
    {id:'observation-completeness',passed:portfolio.observationCompleteRate === 1,detail:String(portfolio.observationCompleteRate)},
    {id:'evidence-coverage',passed:portfolio.evidenceCoverageRate === 1,detail:String(portfolio.evidenceCoverageRate)},
  ];
  const failedChecks = checks.filter(check => !check.passed).map(check => check.id);
  const status = decision === 'accept_baseline'
    ? (failedChecks.length ? 'blocked_acceptance' : 'calibrated')
    : 'action_required';
  return {
    schemaVersion:'1.0.0',
    asOf,
    sourceOutcomeReviewIds:outcomeReport.reviews.map(review=>review.id).sort(),
    minimumSampleSize:input.minimumSampleSize,
    thresholds,
    portfolio,
    byResponse,
    planningSignals:{
      descriptiveEffortMultiplier:portfolio.plannedEffort ? round(portfolio.actualEffort / portfolio.plannedEffort) : null,
      onTimeRate:portfolio.onTimeRate,
      effectivenessRate:portfolio.effectivenessRate,
      recurrenceRate:portfolio.recurrenceRate,
    },
    review,
    checks,
    failedChecks,
    status,
    method:'deterministic portfolio measurement over Project 30 outcomes; signals are descriptive and never rewrite estimates, rank people, or claim causality',
  };
}
