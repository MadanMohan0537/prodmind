const round = value => Number(value.toFixed(4));
const bounded = (value, name, min, max) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
};
const required = (value, name, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
};

function buildPortfolio(runs, requestedIds) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  const requested = requestedIds ? new Set(requestedIds) : null;
  const items = [];
  for (const run of runs) {
    if (!run?.ranking) continue;
    const saved = new Set(run.ranking.portfolio?.selected ?? []);
    for (const item of run.ranking.ranked ?? []) {
      const portfolioItemId = `${run.id}:${item.id}`;
      if (!(requested ? requested.has(portfolioItemId) : saved.has(item.id))) continue;
      if (!Number.isFinite(item.effort) || item.effort <= 0) throw new Error(`Portfolio item ${portfolioItemId} requires positive effort`);
      items.push({portfolioItemId, runId: run.id, runTitle: run.title, opportunityId: item.id, title: item.title, effort: item.effort, score: item.score ?? null, dependencies: [...new Set(item.dependencies ?? [])].map(id => `${run.id}:${id}`), evidenceIds: [...(item.evidenceIds ?? [])]});
    }
  }
  if (requested) {
    const found = new Set(items.map(item => item.portfolioItemId));
    const missing = [...requested].filter(id => !found.has(id));
    if (missing.length) throw new Error(`Unknown portfolioItemIds: ${missing.join(', ')}`);
  }
  if (!items.length) throw new Error('The selected portfolio is empty');
  if (items.length > 100) throw new Error('At most 100 selected portfolio items can be stressed');
  return items;
}

function buildStrategy(strategy, items) {
  if (!strategy || !Array.isArray(strategy.objectives) || !strategy.objectives.length || strategy.objectives.length > 20) throw new Error('Provide 1–20 strategic objectives');
  const objectives = strategy.objectives.map((objective, index) => {
    const id = required(objective.id, `Objective ${index + 1} id`, 80);
    const minShare = bounded(objective.minShare ?? 0, `${id} minShare`, 0, 1);
    const maxShare = bounded(objective.maxShare ?? 1, `${id} maxShare`, 0, 1);
    if (minShare > maxShare) throw new Error(`${id} minShare cannot exceed maxShare`);
    return {id, title: required(objective.title, `${id} title`), minShare, maxShare};
  });
  const objectiveIds = new Set(objectives.map(item => item.id));
  if (objectiveIds.size !== objectives.length) throw new Error('Objective IDs must be unique');
  const exact = new Map();
  const legacy = new Map();
  for (const mapping of strategy.mappings ?? []) {
    if (!objectiveIds.has(mapping.objectiveId)) throw new Error(`Unknown objective: ${mapping.objectiveId}`);
    const opportunityId = required(mapping.opportunityId, 'mapping opportunityId', 120);
    const key = mapping.portfolioItemId ? required(mapping.portfolioItemId, 'mapping portfolioItemId', 240) : mapping.runId ? `${required(mapping.runId, 'mapping runId', 120)}:${opportunityId}` : opportunityId;
    const target = mapping.portfolioItemId || mapping.runId ? exact : legacy;
    if (target.has(key)) throw new Error(`Duplicate mapping: ${key}`);
    target.set(key, mapping.objectiveId);
  }
  for (const [opportunityId, objectiveId] of legacy) {
    const matches = items.filter(item => item.opportunityId === opportunityId);
    if (matches.length > 1) throw new Error(`Mapping ${opportunityId} is ambiguous across runs; provide runId or portfolioItemId`);
    if (matches.length === 1) exact.set(matches[0].portfolioItemId, objectiveId);
  }
  return {objectives, mapping: exact};
}

function normalizeScenarios(scenarios, itemIds) {
  if (!Array.isArray(scenarios) || !scenarios.length || scenarios.length > 12) throw new Error('Provide 1–12 stress scenarios');
  const scenarioIds = new Set();
  return scenarios.map((scenario, index) => {
    const id = required(scenario.id, `Scenario ${index + 1} id`, 80);
    if (scenarioIds.has(id)) throw new Error('Scenario IDs must be unique');
    scenarioIds.add(id);
    const unavailablePortfolioItemIds = [...new Set(scenario.unavailablePortfolioItemIds ?? [])];
    const unknown = unavailablePortfolioItemIds.filter(item => !itemIds.has(item));
    if (unknown.length) throw new Error(`Scenario ${id} references unknown portfolio items: ${unknown.join(', ')}`);
    const effortMultipliers = new Map();
    for (const adjustment of scenario.effortMultipliers ?? []) {
      if (!itemIds.has(adjustment.portfolioItemId)) throw new Error(`Scenario ${id} has an unknown effort adjustment`);
      if (effortMultipliers.has(adjustment.portfolioItemId)) throw new Error(`Scenario ${id} repeats an effort adjustment`);
      effortMultipliers.set(adjustment.portfolioItemId, bounded(adjustment.multiplier, `${id} effort multiplier`, 0.25, 4));
    }
    return {id, name: required(scenario.name ?? id, `${id} name`), capacityFactor: bounded(scenario.capacityFactor ?? 1, `${id} capacityFactor`, 0, 2), unavailablePortfolioItemIds, effortMultipliers};
  });
}

function allocation(available, adjustedEffort, objectives, mapping) {
  const total = available.reduce((sum, item) => sum + adjustedEffort.get(item.portfolioItemId), 0);
  return objectives.map(objective => {
    const assigned = available.filter(item => mapping.get(item.portfolioItemId) === objective.id);
    const effort = assigned.reduce((sum, item) => sum + adjustedEffort.get(item.portfolioItemId), 0);
    const share = total ? effort / total : 0;
    const violation = share < objective.minShare ? objective.minShare - share : share > objective.maxShare ? share - objective.maxShare : 0;
    return {...objective, effort: round(effort), actualShare: round(share), violation: round(violation), portfolioItemIds: assigned.map(item => item.portfolioItemId)};
  });
}

export function stressPortfolio(runs, strategy, input = {}) {
  const items = buildPortfolio(runs, input.portfolioItemIds);
  const itemIds = new Set(items.map(item => item.portfolioItemId));
  const {objectives, mapping} = buildStrategy(strategy, items);
  const unmapped = items.filter(item => !mapping.has(item.portfolioItemId));
  if (unmapped.length) throw new Error(`Every selected portfolio item requires an objective mapping: ${unmapped.map(item => item.portfolioItemId).join(', ')}`);
  const baseCapacity = bounded(input.capacity, 'capacity', 0.01, 100000);
  const scenarios = normalizeScenarios(input.scenarios, itemIds);
  const results = scenarios.map(scenario => {
    const unavailable = new Set(scenario.unavailablePortfolioItemIds);
    const adjustedEffort = new Map(items.map(item => [item.portfolioItemId, item.effort * (scenario.effortMultipliers.get(item.portfolioItemId) ?? 1)]));
    const available = items.filter(item => !unavailable.has(item.portfolioItemId));
    const effectiveCapacity = baseCapacity * scenario.capacityFactor;
    const usedCapacity = items.reduce((sum, item) => sum + adjustedEffort.get(item.portfolioItemId), 0);
    const capacityOverrun = Math.max(0, usedCapacity - effectiveCapacity);
    const dependencyFailures = items.flatMap(item => item.dependencies.filter(dependency => !itemIds.has(dependency) || unavailable.has(dependency)).map(dependency => ({portfolioItemId: item.portfolioItemId, dependencyPortfolioItemId: dependency})));
    const allocations = allocation(available, adjustedEffort, objectives, mapping);
    const rangeViolation = allocations.reduce((sum, item) => sum + item.violation, 0);
    const unavailableShare = unavailable.size / items.length;
    const dependencyShare = dependencyFailures.length / Math.max(1, items.length);
    const overrunShare = capacityOverrun / Math.max(1, effectiveCapacity);
    const resilienceScore = round(Math.max(0, 100 - Math.min(50, overrunShare * 50) - unavailableShare * 35 - Math.min(30, dependencyShare * 30) - Math.min(35, rangeViolation * 35)));
    const critical = capacityOverrun > 0 || dependencyFailures.length > 0;
    return {id: scenario.id, name: scenario.name, status: critical ? 'critical' : rangeViolation > 0 || unavailable.size ? 'degraded' : 'resilient', resilienceScore, effectiveCapacity: round(effectiveCapacity), usedCapacity: round(usedCapacity), capacityOverrun: round(capacityOverrun), unavailablePortfolioItemIds: [...unavailable], dependencyFailures, allocation: allocations, rangeViolation: round(rangeViolation), atRiskItems: items.filter(item => unavailable.has(item.portfolioItemId) || dependencyFailures.some(failure => failure.portfolioItemId === item.portfolioItemId))};
  });
  const mean = results.reduce((sum, result) => sum + result.resilienceScore, 0) / results.length;
  const weakest = [...results].sort((a, b) => a.resilienceScore - b.resilienceScore || a.id.localeCompare(b.id))[0];
  return {schemaVersion: '1.0.0', status: results.some(item => item.status === 'critical') ? 'exposed' : results.some(item => item.status === 'degraded') ? 'review' : 'resilient', baseCapacity, portfolioItems: items, summary: {scenarios: results.length, resilient: results.filter(item => item.status === 'resilient').length, degraded: results.filter(item => item.status === 'degraded').length, critical: results.filter(item => item.status === 'critical').length, meanResilienceScore: round(mean), weakestScenarioId: weakest.id, weakestScenarioScore: weakest.resilienceScore}, scenarios: results, method: 'deterministic declared-scenario stress test; no probabilities, causal claims, or automatic portfolio changes'};
}
