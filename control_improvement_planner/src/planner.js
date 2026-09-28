const checkWeights = {
  'verified-exit': 10,
  'target-stable': 10,
  'remediation-maintained': 8,
  'lineage-continuity': 7,
  'monitor-cadence': 5,
  'snapshot-coverage': 4,
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

function deriveTargets(recurrenceReport) {
  return recurrenceReport.surveillance
    .filter(item => item.recurrenceCount > 0 || item.failedChecks.length > 0)
    .map(item => {
      const failedWeight = item.failedChecks.reduce((sum, id) => sum + (checkWeights[id] ?? 2), 0);
      return {
        id: item.id,
        exitReviewId: item.exitReviewId,
        governancePackId: item.governancePackId,
        portfolioItemId: item.portfolioItemId,
        title: item.title,
        evidenceIds: [...(item.evidenceIds ?? [])],
        recurrenceCount: item.recurrenceCount,
        failedChecks: [...item.failedChecks],
        firstRecurrenceAt: item.firstRecurrenceAt,
        riskPoints: Math.min(100, item.recurrenceCount * 10 + failedWeight),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeCandidates(rawCandidates, targets, asOf) {
  if (!Array.isArray(rawCandidates) || rawCandidates.length > 16) {
    throw new Error('Provide an array of at most 16 improvement candidates');
  }
  const targetMap = new Map(targets.map(item => [item.id, item]));
  const ids = new Set();
  const candidates = rawCandidates.map((raw, index) => {
    const id = required(raw.id, `Candidate ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error('Candidate IDs must be unique');
    ids.add(id);
    if (!Array.isArray(raw.covers) || !raw.covers.length || raw.covers.length > 20) {
      throw new Error(`${id} must cover 1–20 recurrence findings`);
    }
    const covers = [...new Set(raw.covers.map(value => required(value, `${id} finding`, 80)))];
    if (covers.some(value => !targetMap.has(value))) throw new Error(`${id} must cover known actionable findings`);
    const dueAt = timestamp(raw.dueAt, `${id} dueAt`);
    if (Date.parse(dueAt) <= Date.parse(asOf)) throw new Error(`${id} dueAt must be after asOf`);
    const response = required(raw.response, `${id} response`, 20);
    if (!['prevent', 'detect', 'govern'].includes(response)) throw new Error(`${id} response is invalid`);
    return {
      id,
      title: required(raw.title, `${id} title`, 200),
      owner: required(raw.owner, `${id} owner`, 120),
      effort: integer(raw.effort, `${id} effort`, 1, 1000),
      covers,
      dependencies: [...new Set(raw.dependencies ?? [])],
      response,
      dueAt,
      successMetric: required(raw.successMetric, `${id} successMetric`, 500),
      verificationWindowDays: integer(raw.verificationWindowDays, `${id} verificationWindowDays`, 1, 365),
    };
  });
  const byId = new Map(candidates.map(item => [item.id, item]));
  for (const candidate of candidates) {
    for (const dependency of candidate.dependencies) {
      if (!byId.has(dependency) || dependency === candidate.id) {
        throw new Error(`${candidate.id} has an invalid dependency`);
      }
    }
  }
  return candidates;
}

function optimize(candidates, targetMap, capacity) {
  let best = {mask: 0, value: 0, effort: 0, count: 0, covered: new Set()};
  const combinations = 2 ** candidates.length;
  const indexes = new Map(candidates.map((item, index) => [item.id, index]));
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

export function planControlImprovements(runs, recurrenceReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (recurrenceReport?.schemaVersion !== '1.0.0' || !Array.isArray(recurrenceReport.surveillance)) {
    throw new Error('Provide a Project 28 recurrence report');
  }
  const asOf = timestamp(input.asOf, 'asOf');
  const capacity = integer(input.capacity, 'capacity', 0, 1000);
  if (typeof input.minimumCoverageRate !== 'number' || input.minimumCoverageRate < 0 || input.minimumCoverageRate > 1) {
    throw new Error('minimumCoverageRate must be from 0 to 1');
  }
  const targets = deriveTargets(recurrenceReport);
  const targetMap = new Map(targets.map(item => [item.id, item]));
  const candidates = normalizeCandidates(input.candidates ?? [], targets, asOf);
  const result = optimize(candidates, targetMap, capacity);
  const selected = candidates.filter((_, index) => result.mask & (2 ** index));
  const coveredTargets = targets.filter(item => result.covered.has(item.id));
  const uncoveredTargets = targets.filter(item => !result.covered.has(item.id));
  const totalRiskPoints = targets.reduce((sum, item) => sum + item.riskPoints, 0);
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
  let status = 'no_findings';
  if (targets.length && decision !== 'approve') status = 'action_required';
  if (targets.length && decision === 'approve') {
    status = coverageRate >= input.minimumCoverageRate ? 'approved' : 'blocked_approval';
  }
  return {
    schemaVersion: '1.0.0',
    asOf,
    capacity,
    usedCapacity: result.effort,
    remainingCapacity: capacity - result.effort,
    minimumCoverageRate: input.minimumCoverageRate,
    status,
    summary: {
      actionableFindings: targets.length,
      candidates: candidates.length,
      selected: selected.length,
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
    selectedActions: selected,
    coveredTargets,
    uncoveredTargets,
    allCandidates: candidates,
    review,
    method: 'deterministic recurrence-derived risk points and exact capacity-constrained selection; the plan never changes controls or executes work',
  };
}

