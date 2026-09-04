const DEFAULT_WEIGHTS = Object.freeze({
  businessValue: 0.25,
  userValue: 0.2,
  strategicAlignment: 0.2,
  confidence: 0.15,
  feasibility: 0.1,
  urgency: 0.1
});

const VALUE_FIELDS = Object.keys(DEFAULT_WEIGHTS);

function bounded(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function clean(value, fallback = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => clean(item)).filter(Boolean))];
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

export function normalizeOpportunity(input, index = 0) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("opportunity must be an object");
  const title = clean(input.title);
  if (!title) throw new TypeError("opportunity.title must be a non-empty string");
  if (title.length > 200) throw new RangeError("opportunity.title must not exceed 200 characters");
  return {
    id: clean(input.id, `opportunity-${index + 1}`),
    title,
    description: clean(input.description),
    businessValue: bounded(input.businessValue, 0, 10, 5),
    userValue: bounded(input.userValue, 0, 10, 5),
    strategicAlignment: bounded(input.strategicAlignment, 0, 10, 5),
    confidence: bounded(input.confidence, 0, 1, 0.5),
    feasibility: bounded(input.feasibility, 0, 1, 0.5),
    urgency: bounded(input.urgency, 0, 10, 5),
    effort: bounded(input.effort, 0.1, 10_000, 5),
    risk: bounded(input.risk, 0, 1, 0.3),
    uncertainty: bounded(input.uncertainty, 0, 0.75, 0.2),
    evidenceCount: Math.floor(bounded(input.evidenceCount, 0, 1_000_000, 0)),
    dependencies: uniqueStrings(input.dependencies),
    tags: uniqueStrings(input.tags),
    owner: clean(input.owner, "Unassigned")
  };
}

export function normalizeWeights(input = {}) {
  const weights = Object.fromEntries(VALUE_FIELDS.map(field => [field, bounded(input[field], 0, 1, DEFAULT_WEIGHTS[field])]));
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!total) throw new RangeError("at least one weight must be greater than zero");
  return Object.fromEntries(Object.entries(weights).map(([field, value]) => [field, value / total]));
}

function normalizedValue(field, value) {
  return ["confidence", "feasibility"].includes(field) ? value : value / 10;
}

export function scoreOpportunity(opportunity, weights = DEFAULT_WEIGHTS, effortBaseline = 5) {
  const normalized = normalizeOpportunity(opportunity);
  const appliedWeights = normalizeWeights(weights);
  const contributions = VALUE_FIELDS.map(field => ({
    factor: field,
    raw: normalized[field],
    weight: round(appliedWeights[field]),
    contribution: round(normalizedValue(field, normalized[field]) * appliedWeights[field] * 100, 2)
  }));
  const valueScore = contributions.reduce((sum, item) => sum + item.contribution, 0);
  const effortModifier = Math.max(0.6, Math.min(1.4, Math.sqrt(Math.max(effortBaseline, 0.1) / normalized.effort)));
  const riskModifier = 1 - normalized.risk * 0.35;
  const score = Math.max(0, Math.min(100, valueScore * effortModifier * riskModifier));
  return {
    ...normalized,
    score: round(score, 2),
    valueScore: round(valueScore, 2),
    effortModifier: round(effortModifier),
    riskModifier: round(riskModifier),
    contributions: contributions.sort((a, b) => b.contribution - a.contribution),
    explanation: `${contributions.sort((a, b) => b.contribution - a.contribution).slice(0, 2).map(item => item.factor.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)).join(" and ")} contribute most; effort and risk adjust the final score.`
  };
}

function generator(seed = 42) {
  let state = Math.floor(Number(seed)) || 42;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function triangular(random, low, mode, high) {
  const value = random();
  const split = (mode - low) / (high - low || 1);
  return value < split ? low + Math.sqrt(value * (high - low) * (mode - low)) : high - Math.sqrt((1 - value) * (high - low) * (high - mode));
}

function percentile(values, probability) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * probability)))];
}

export function simulateOpportunity(opportunity, options = {}) {
  const normalized = normalizeOpportunity(opportunity);
  const iterations = Math.floor(bounded(options.iterations, 100, 5_000, 1_000));
  const random = generator((options.seed ?? 42) + [...normalized.id].reduce((sum, character) => sum + character.charCodeAt(0), 0));
  const scores = [];
  for (let index = 0; index < iterations; index += 1) {
    const uncertainty = normalized.uncertainty;
    const sampled = { ...normalized };
    for (const field of VALUE_FIELDS) {
      const maximum = ["confidence", "feasibility"].includes(field) ? 1 : 10;
      sampled[field] = triangular(random, Math.max(0, normalized[field] * (1 - uncertainty)), normalized[field], Math.min(maximum, normalized[field] * (1 + uncertainty)));
    }
    sampled.effort = triangular(random, Math.max(0.1, normalized.effort * (1 - uncertainty)), normalized.effort, normalized.effort * (1 + uncertainty));
    scores.push(scoreOpportunity(sampled, options.weights, options.effortBaseline).score);
  }
  return { p10: round(percentile(scores, 0.1), 2), p50: round(percentile(scores, 0.5), 2), p90: round(percentile(scores, 0.9), 2), mean: round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 2), iterations };
}

function dominates(left, right) {
  const leftValues = [left.valueScore, left.confidence * 100, left.feasibility * 100, -left.effort, -left.risk * 100];
  const rightValues = [right.valueScore, right.confidence * 100, right.feasibility * 100, -right.effort, -right.risk * 100];
  return leftValues.every((value, index) => value >= rightValues[index]) && leftValues.some((value, index) => value > rightValues[index]);
}

export function paretoFront(items) {
  return items.filter(candidate => !items.some(other => other.id !== candidate.id && dominates(other, candidate))).map(item => item.id);
}

export function selectPortfolio(ranked, capacity) {
  const byId = new Map(ranked.map(item => [item.id, item]));
  const selected = [];
  const selectedIds = new Set();
  let used = 0;
  const add = item => {
    if (!item || selectedIds.has(item.id)) return true;
    for (const dependencyId of item.dependencies) {
      if (!byId.has(dependencyId) || !add(byId.get(dependencyId))) return false;
    }
    if (used + item.effort > capacity) return false;
    selected.push(item);
    selectedIds.add(item.id);
    used += item.effort;
    return true;
  };
  ranked.forEach(add);
  return { selected: selected.map(item => item.id), capacity, used: round(used, 2), remaining: round(capacity - used, 2) };
}

export function prioritize(input, options = {}) {
  if (!Array.isArray(input) || !input.length) throw new TypeError("opportunities must be a non-empty array");
  if (input.length > 500) throw new RangeError("maximum batch size is 500 opportunities");
  const opportunities = input.map(normalizeOpportunity);
  const ids = new Set();
  opportunities.forEach(item => {
    if (ids.has(item.id)) throw new TypeError(`duplicate opportunity id: ${item.id}`);
    ids.add(item.id);
  });
  const effortBaseline = percentile(opportunities.map(item => item.effort), 0.5);
  const scored = opportunities.map(item => ({ ...scoreOpportunity(item, options.weights, effortBaseline), uncertaintyBand: simulateOpportunity(item, { ...options, effortBaseline }) }));
  const frontier = new Set(paretoFront(scored));
  const ranked = scored.sort((a, b) => b.uncertaintyBand.p50 - a.uncertaintyBand.p50 || b.score - a.score || a.id.localeCompare(b.id)).map((item, index) => ({
    ...item,
    rank: index + 1,
    paretoOptimal: frontier.has(item.id),
    blockedBy: item.dependencies.filter(dependency => !ids.has(dependency))
  }));
  const capacity = bounded(options.capacity, 0.1, 1_000_000, opportunities.reduce((sum, item) => sum + item.effort, 0));
  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    method: "transparent-weighted-score+monte-carlo+pareto-frontier+dependency-aware-selection",
    weights: normalizeWeights(options.weights),
    ranked,
    paretoFrontier: [...frontier],
    portfolio: selectPortfolio(ranked.filter(item => !item.blockedBy.length), capacity)
  };
}

export { DEFAULT_WEIGHTS };
