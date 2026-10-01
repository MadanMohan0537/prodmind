const checkPolicy = {
  'sample-size': {riskPoints: 10, policyArea: 'measurement'},
  'evidence-coverage': {riskPoints: 9, policyArea: 'measurement'},
  'observation-completeness': {riskPoints: 8, policyArea: 'measurement'},
  'observed-effectiveness': {riskPoints: 8, policyArea: 'effectiveness'},
  'recurrence-rate': {riskPoints: 8, policyArea: 'recurrence'},
  'effort-bias': {riskPoints: 6, policyArea: 'estimation'},
  'on-time-delivery': {riskPoints: 6, policyArea: 'delivery'},
};

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

function deriveTargets(calibrationReport) {
  return calibrationReport.checks
    .filter(check => check.passed === false)
    .map(check => {
      const policy = checkPolicy[check.id];
      if (!policy) throw new Error(`Unsupported Project 31 check: ${check.id}`);
      return {
        id: check.id,
        detail: required(check.detail, `${check.id} detail`, 500),
        riskPoints: policy.riskPoints,
        policyArea: policy.policyArea,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeCandidates(rawCandidates, targets, asOf) {
  if (!Array.isArray(rawCandidates) || rawCandidates.length > 16) {
    throw new Error('Provide an array of at most 16 policy experiment candidates');
  }
  const targetMap = new Map(targets.map(target => [target.id, target]));
  const ids = new Set();
  const candidates = rawCandidates.map((raw, index) => {
    const id = required(raw.id, `Candidate ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error('Candidate IDs must be unique');
    ids.add(id);
    if (!Array.isArray(raw.covers) || !raw.covers.length || raw.covers.length > 7) {
      throw new Error(`${id} must cover 1–7 calibration gaps`);
    }
    const covers = [...new Set(raw.covers.map(value => required(value, `${id} gap`, 80)))];
    if (covers.some(value => !targetMap.has(value))) throw new Error(`${id} must cover known failed calibration checks`);
    const policyArea = required(raw.policyArea, `${id} policyArea`, 30);
    if (!['estimation', 'delivery', 'effectiveness', 'recurrence', 'measurement', 'cross_cutting'].includes(policyArea)) {
      throw new Error(`${id} policyArea is invalid`);
    }
    if (policyArea !== 'cross_cutting' && covers.some(value => targetMap.get(value).policyArea !== policyArea)) {
      throw new Error(`${id} policyArea does not match every covered gap`);
    }
    const startsAt = timestamp(raw.startsAt, `${id} startsAt`);
    const reviewAt = timestamp(raw.reviewAt, `${id} reviewAt`);
    if (Date.parse(startsAt) <= Date.parse(asOf)) throw new Error(`${id} startsAt must be after asOf`);
    if (Date.parse(reviewAt) <= Date.parse(startsAt)) throw new Error(`${id} reviewAt must be after startsAt`);
    const minimumObservationDays = integer(raw.minimumObservationDays, `${id} minimumObservationDays`, 1, 365);
    const scheduledDays = Math.floor((Date.parse(reviewAt) - Date.parse(startsAt)) / 86_400_000);
    if (scheduledDays < minimumObservationDays) throw new Error(`${id} review window is shorter than minimumObservationDays`);
    if (raw.reversible !== true) throw new Error(`${id} must be explicitly reversible`);
    return {
      id,
      title: required(raw.title, `${id} title`, 200),
      owner: required(raw.owner, `${id} owner`, 120),
      effort: integer(raw.effort, `${id} effort`, 1, 1000),
      covers,
      dependencies: [...new Set(raw.dependencies ?? [])],
      policyArea,
      hypothesis: required(raw.hypothesis, `${id} hypothesis`, 1000),
      changeDescription: required(raw.changeDescription, `${id} changeDescription`, 1000),
      successMetric: required(raw.successMetric, `${id} successMetric`, 500),
      guardrail: required(raw.guardrail, `${id} guardrail`, 500),
      rollbackPlan: required(raw.rollbackPlan, `${id} rollbackPlan`, 1000),
      reversible: true,
      startsAt,
      reviewAt,
      minimumObservationDays,
    };
  });
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  for (const candidate of candidates) {
    for (const dependency of candidate.dependencies) {
      if (!byId.has(dependency) || dependency === candidate.id) throw new Error(`${candidate.id} has an invalid dependency`);
    }
  }
  return candidates;
}

function optimize(candidates, targetMap, capacity) {
  const indexes = new Map(candidates.map((candidate, index) => [candidate.id, index]));
  let best = {mask: 0, value: 0, effort: 0, count: 0, covered: new Set()};
  const combinations = 2 ** candidates.length;
  for (let mask = 0; mask < combinations; mask++) {
    let effort = 0;
    let count = 0;
    let valid = true;
    const covered = new Set();
    for (let index = 0; index < candidates.length; index++) {
      if (!(mask & (2 ** index))) continue;
      const candidate = candidates[index];
      count++;
      effort += candidate.effort;
      if (effort > capacity || candidate.dependencies.some(id => !(mask & (2 ** indexes.get(id))))) {
        valid = false;
        break;
      }
      candidate.covers.forEach(id => covered.add(id));
    }
    if (!valid) continue;
    const value = [...covered].reduce((sum, id) => sum + targetMap.get(id).riskPoints, 0);
    const better = value > best.value
      || (value === best.value && effort < best.effort)
      || (value === best.value && effort === best.effort && count < best.count)
      || (value === best.value && effort === best.effort && count === best.count && mask < best.mask);
    if (better) best = {mask, value, effort, count, covered};
  }
  return {...best, combinations};
}

export function planPolicyExperiments(runs, calibrationReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (calibrationReport?.schemaVersion !== '1.0.0' || !Array.isArray(calibrationReport.checks)) {
    throw new Error('Provide a Project 31 calibration report');
  }
  if (!['calibrated', 'blocked_acceptance', 'action_required'].includes(calibrationReport.status)) {
    throw new Error('Project 31 calibration status is invalid');
  }
  const asOf = timestamp(input.asOf, 'asOf');
  if (Date.parse(calibrationReport.asOf) > Date.parse(asOf)) throw new Error('Project 31 report occurs after asOf');
  const capacity = integer(input.capacity, 'capacity', 0, 1000);
  if (typeof input.minimumCoverageRate !== 'number' || input.minimumCoverageRate < 0 || input.minimumCoverageRate > 1) {
    throw new Error('minimumCoverageRate must be from 0 to 1');
  }
  const targets = deriveTargets(calibrationReport);
  const targetMap = new Map(targets.map(target => [target.id, target]));
  const candidates = normalizeCandidates(input.candidates ?? [], targets, asOf);
  const result = optimize(candidates, targetMap, capacity);
  const selectedExperiments = candidates.filter((_, index) => result.mask & (2 ** index));
  const coveredTargets = targets.filter(target => result.covered.has(target.id));
  const uncoveredTargets = targets.filter(target => !result.covered.has(target.id));
  const totalRiskPoints = targets.reduce((sum, target) => sum + target.riskPoints, 0);
  const coverageRate = totalRiskPoints ? round(result.value / totalRiskPoints) : 1;
  const rawReview = input.review ?? {};
  const decision = required(rawReview.decision, 'review decision', 20);
  if (!['approve', 'revise', 'defer'].includes(decision)) throw new Error('review decision is invalid');
  const review = {
    reviewer: required(rawReview.reviewer, 'review reviewer', 120),
    decision,
    rationale: required(rawReview.rationale, 'review rationale', 1000),
    reviewedAt: timestamp(rawReview.reviewedAt, 'review reviewedAt'),
  };
  if (Date.parse(review.reviewedAt) > Date.parse(asOf)) throw new Error('review cannot occur after asOf');
  let status = 'no_gaps';
  if (targets.length && decision !== 'approve') status = 'action_required';
  if (targets.length && decision === 'approve') {
    status = coverageRate >= input.minimumCoverageRate ? 'approved' : 'blocked_approval';
  }
  return {
    schemaVersion: '1.0.0',
    asOf,
    sourceCalibrationAsOf: calibrationReport.asOf,
    sourceOutcomeReviewIds: [...(calibrationReport.sourceOutcomeReviewIds ?? [])],
    capacity,
    usedCapacity: result.effort,
    remainingCapacity: capacity - result.effort,
    minimumCoverageRate: input.minimumCoverageRate,
    status,
    summary: {
      calibrationGaps: targets.length,
      candidates: candidates.length,
      selected: selectedExperiments.length,
      covered: coveredTargets.length,
      uncovered: uncoveredTargets.length,
      totalRiskPoints,
      coveredRiskPoints: result.value,
      coverageRate,
    },
    objective: {
      method: 'exact bounded subset optimization with dependency and capacity constraints',
      optimal: true,
      combinationsEvaluated: result.combinations,
    },
    selectedExperiments,
    coveredTargets,
    uncoveredTargets,
    allCandidates: candidates,
    review,
    method: 'deterministic calibration-gap coverage and exact capacity-constrained selection; experiments are reversible proposals and never change planning policy automatically',
  };
}
