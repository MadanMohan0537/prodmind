const stopWords = new Set(['a','an','and','are','as','at','be','by','for','from','in','is','it','of','on','or','that','the','this','to','was','were','will','with']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function tokens(value) {
  return [...new Set(text(value).toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 1 && !stopWords.has(word)) ?? [])];
}

function cardFrom(run, experiment) {
  const decision = experiment.decision;
  const reviews = experiment.outcomeReviews ?? [];
  const latest = reviews.at(-1) ?? null;
  const evidenceById = new Map((run.evidence ?? []).map(item => [item.id, item]));
  const evidence = experiment.evidenceIds.map(id => evidenceById.get(id)).filter(Boolean);
  const opportunity = experiment.opportunitySnapshot ?? {};
  return {
    id: decision.id ?? decision.auditId,
    runId: run.id,
    runTitle: run.title,
    opportunityId: experiment.opportunityId,
    opportunityTitle: opportunity.title ?? 'Untitled opportunity',
    topicId: opportunity.topicId ?? null,
    experimentId: experiment.id,
    decisionId: decision.id ?? decision.auditId,
    hypothesis: experiment.plan?.hypothesis ?? '',
    primaryMetric: experiment.plan?.primaryMetric ?? '',
    outcome: decision.outcome,
    rationale: decision.rationale,
    reviewer: decision.reviewer,
    decidedAt: decision.decidedAt,
    evidenceIds: [...experiment.evidenceIds],
    evidence: evidence.map(item => ({id: item.id, source: item.source, text: item.text, topicId: item.topicId, sentiment: item.sentiment?.label, intent: item.detection?.primaryIntent})),
    monitoring: latest ? {status: latest.analysis.status, relativeChange: latest.analysis.relativeChange, targetMet: latest.analysis.targetMet, reviewedAt: latest.createdAt, monitorId: latest.monitorId} : null,
    reviewCount: reviews.length,
  };
}

export function buildLearningMemory(runs) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  const cards = [];
  for (const run of runs) {
    if (!run || !Array.isArray(run.experiments)) throw new Error('Each product run must contain experiments');
    for (const experiment of run.experiments) if (experiment.decision) cards.push(cardFrom(run, experiment));
  }
  cards.sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)) || a.decisionId.localeCompare(b.decisionId));
  const monitored = cards.filter(card => card.monitoring);
  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    summary: {
      runs: runs.length,
      decisions: cards.length,
      monitoredDecisions: monitored.length,
      monitoringCoverage: cards.length ? Number((monitored.length / cards.length).toFixed(4)) : 0,
      evidenceRecords: new Set(cards.flatMap(card => card.evidenceIds)).size,
      outcomes: Object.fromEntries(['ship','iterate','reject'].map(outcome => [outcome, cards.filter(card => card.outcome === outcome).length])),
    },
    cards,
  };
}

export function searchLearningMemory(memory, query, filters = {}) {
  if (!memory || !Array.isArray(memory.cards)) throw new Error('A built learning memory is required');
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) throw new Error('Query must contain 2–200 characters');
  if (filters.outcome && !['ship','iterate','reject'].includes(filters.outcome)) throw new Error('Unknown outcome filter');
  if (filters.status && !['sustained','emerging','below_target','at_risk','unmonitored'].includes(filters.status)) throw new Error('Unknown monitoring status filter');
  const queryTokens = tokens(query);
  const results = memory.cards.flatMap(card => {
    const status = card.monitoring?.status ?? 'unmonitored';
    if ((filters.outcome && card.outcome !== filters.outcome) || (filters.status && status !== filters.status)) return [];
    const fields = [
      ['opportunity', card.opportunityTitle, 5], ['hypothesis', card.hypothesis, 4],
      ['metric', card.primaryMetric, 3], ['rationale', card.rationale, 2],
      ['evidence', card.evidence.map(item => item.text).join(' '), 1],
    ];
    let score = 0; const matches = [];
    for (const [field, value, weight] of fields) {
      const words = new Set(tokens(value)); const shared = queryTokens.filter(word => words.has(word));
      if (shared.length) {score += shared.length * weight; matches.push({field, terms: shared});}
    }
    return score ? [{...card, relevance: score, matches}] : [];
  });
  results.sort((a,b) => b.relevance - a.relevance || String(b.decidedAt).localeCompare(String(a.decidedAt)));
  return {query: query.trim(), filters, total: results.length, results: results.slice(0, 20), method: 'deterministic weighted token overlap; review source evidence before reuse'};
}
