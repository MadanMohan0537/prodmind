const round = value => Number(value.toFixed(4));
const text = (value, name, max = 240) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
};
const number = (value, name) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
};
const date = (value, name) => {
  const parsed = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(parsed.valueOf())) throw new Error(`${name} must be an ISO date`);
  return parsed.toISOString();
};

function portfolio(runs) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  const items = new Map();
  for (const run of runs) {
    if (!run?.id || !run?.ranking) continue;
    const selected = new Set(run.ranking.portfolio?.selected ?? []);
    for (const opportunity of run.ranking.ranked ?? []) {
      if (!selected.has(opportunity.id)) continue;
      const portfolioItemId = `${run.id}:${opportunity.id}`;
      const experiments = (run.experiments ?? []).filter(item => item.opportunityId === opportunity.id);
      const decisions = experiments.flatMap(item => item.decision ? [{experimentId:item.id, ...item.decision}] : []);
      const outcomeReviews = experiments.flatMap(item => (item.outcomeReviews ?? []).map(review => ({experimentId:item.id, ...review})));
      items.set(portfolioItemId, {portfolioItemId, runId:run.id, runTitle:run.title, opportunityId:opportunity.id, title:opportunity.title, evidenceIds:[...(opportunity.evidenceIds ?? [])], experimentIds:experiments.map(item => item.id), decisionIds:decisions.map(item => item.id), outcomeReviewIds:outcomeReviews.map(item => item.id)});
    }
  }
  return items;
}

function normalizeBenefit(raw, index, items, asOf) {
  const id = text(raw.id, `Benefit ${index + 1} id`, 80);
  const portfolioItemId = text(raw.portfolioItemId, `${id} portfolioItemId`, 240);
  const item = items.get(portfolioItemId);
  if (!item) throw new Error(`Unknown selected portfolio item: ${portfolioItemId}`);
  const direction = raw.direction;
  if (!['increase','decrease'].includes(direction)) throw new Error(`${id} direction must be increase or decrease`);
  const baseline = number(raw.baseline, `${id} baseline`);
  const target = number(raw.target, `${id} target`);
  if (direction === 'increase' ? target <= baseline : target >= baseline) throw new Error(`${id} target must move in the declared direction`);
  const actual = raw.actual === null || raw.actual === undefined ? null : number(raw.actual, `${id} actual`);
  const baselineAt = date(raw.baselineAt, `${id} baselineAt`);
  const targetAt = date(raw.targetAt, `${id} targetAt`);
  const measuredAt = actual === null ? null : date(raw.measuredAt, `${id} measuredAt`);
  if (new Date(targetAt) <= new Date(baselineAt)) throw new Error(`${id} targetAt must be after baselineAt`);
  if (measuredAt && new Date(measuredAt) < new Date(baselineAt)) throw new Error(`${id} measuredAt cannot predate baselineAt`);
  const expectedChange = Math.abs(target - baseline);
  const realizedChange = actual === null ? null : (direction === 'increase' ? actual - baseline : baseline - actual);
  const progress = actual === null ? null : realizedChange / expectedChange;
  const overdue = actual === null && new Date(targetAt) < new Date(asOf);
  const status = actual === null ? (overdue ? 'overdue' : 'not_measured') : progress >= 1 ? 'realized' : new Date(measuredAt) >= new Date(targetAt) ? 'below_target' : progress >= .75 ? 'on_track' : 'at_risk';
  return {...item, id, name:text(raw.name, `${id} name`), unit:text(raw.unit, `${id} unit`, 80), direction, baseline, target, actual, baselineAt, targetAt, measuredAt, owner:text(raw.owner, `${id} owner`, 120), attributionNote:text(raw.attributionNote, `${id} attributionNote`, 1000), progress:progress === null ? null : round(progress), expectedChange:round(expectedChange), realizedChange:realizedChange === null ? null : round(realizedChange), remaining:actual === null ? null : round(Math.max(0, expectedChange - realizedChange)), status};
}

export function trackBenefits(runs, input = {}, now = () => new Date()) {
  if (!input || !Array.isArray(input.benefits) || !input.benefits.length || input.benefits.length > 100) throw new Error('Provide 1–100 benefit records');
  const asOf = date(input.asOf ?? now().toISOString(), 'asOf');
  const items = portfolio(runs);
  const benefits = input.benefits.map((item, index) => normalizeBenefit(item, index, items, asOf));
  if (new Set(benefits.map(item => item.id)).size !== benefits.length) throw new Error('Benefit IDs must be unique');
  const units = [...new Set(benefits.map(item => item.unit))].sort().map(unit => {
    const set = benefits.filter(item => item.unit === unit);
    const measured = set.filter(item => item.progress !== null);
    return {unit, benefits:set.length, measured:measured.length, meanProgress:measured.length ? round(measured.reduce((sum, item) => sum + item.progress, 0) / measured.length) : null};
  });
  const counts = Object.fromEntries(['realized','on_track','at_risk','below_target','not_measured','overdue'].map(status => [status, benefits.filter(item => item.status === status).length]));
  return {schemaVersion:'1.0.0', asOf, summary:{benefits:benefits.length, measured:benefits.filter(item => item.actual !== null).length, ...counts}, units, benefits, method:'deterministic target-progress ledger; incompatible units are never summed; attribution remains a reviewed note, not a causal claim'};
}
