import {prepareRecord} from '../../feedback_collector/src/worker.js';
import {analyzeSentiment} from '../../sentiment_analyzer/public/analyzer.js';
import {modelTopics} from '../../topic_modeler/public/topic-modeler.js';
import {detectIntents} from '../../feature_request_detector/public/detector.js';
import {buildDashboard} from '../../voice_of_customer_dashboard/public/analytics.js';
import {prioritize} from '../../prioritization_engine/public/engine.js';

export function requireText(value, name, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
}

export function number(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number between ${min} and ${max}`);
  return value;
}

/** Project 1 -> 2 -> 3 -> 4 -> 5. Input evidence is never discarded by text-only dedup. */
export async function discover(input, now = new Date().toISOString()) {
  if (!input || !Array.isArray(input.records) || !input.records.length || input.records.length > 100) throw new Error('Provide 1–100 feedback records');
  const title = requireText(input.title, 'title', 160);
  const ids = new Set();
  const prepared = [];
  for (const [index, raw] of input.records.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Record ${index + 1} must be an object`);
    const id = requireText(raw.id, `Record ${index + 1} id`, 100);
    if (ids.has(id)) throw new Error(`Duplicate evidence ID: ${id}`);
    ids.add(id);
    requireText(raw.text ?? raw.feedback ?? raw.review ?? raw.comment, 'feedback text', 4000);
    const timestamp = requireText(raw.createdAt ?? raw.timestamp ?? raw.created_at, 'evidence timestamp', 40);
    if (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) > Date.parse(now)) throw new Error('Evidence timestamps must be valid and not in the future');
    const metadata = typeof raw.metadata === 'string' ? JSON.parse(raw.metadata) : raw.metadata;
    const record = await prepareRecord({...raw, metadata, id, createdAt: new Date(timestamp).toISOString()}, index);
    if (record.errors) throw new Error(`Record ${index + 1}: ${record.errors.join('; ')}`);
    prepared.push({...record.value, segment: typeof raw.segment === 'string' ? raw.segment.slice(0, 100) : 'unknown', customerId: typeof raw.customerId === 'string' ? raw.customerId.slice(0, 100) : 'anonymous'});
  }
  const sentiments = prepared.map(e => ({...e, sentiment: analyzeSentiment(e.text)}));
  const topics = modelTopics(sentiments.map(e => ({id: e.id, text: e.text, source: e.source, timestamp: e.createdAt})));
  const assignments = new Map(topics.assignments.map(a => [a.documentId, a.topicId]));
  const evidence = sentiments.map(e => ({...e, detection: detectIntents(e.text), topicId: assignments.get(e.id)}));
  const dashboard = buildDashboard(evidence.map(e => ({...e, timestamp: e.createdAt, topics: [e.topicId], intents: e.detection.intents})), {}, {evidenceLimit: 100});
  const opportunities = topics.topics.map(topic => {
    const members = evidence.filter(e => e.topicId === topic.id);
    return {id: `opp-${topic.id}`, title: `Investigate: ${topic.label}`.slice(0, 200), topicId: topic.id, evidenceIds: members.map(e => e.id), evidenceCount: members.length, needsReview: true};
  });
  const fingerprints = new Map();
  for (const e of evidence) fingerprints.set(e.fingerprint, [...(fingerprints.get(e.fingerprint) ?? []), e.id]);
  return {
    schemaVersion: '2.0.0', id: crypto.randomUUID(), version: 1, title, createdAt: now, updatedAt: now,
    stage: 'discovered', evidence, topics, dashboard, opportunities, ranking: null, experiments: [],
    duplicateCandidates: [...fingerprints.values()].filter(ids => ids.length > 1),
    policy: 'All distinct source IDs retained; text similarity is a review flag, not proof of duplicate customers.',
  };
}

const ranges = {businessValue: [0, 10], userValue: [0, 10], strategicAlignment: [0, 10], confidence: [0, 1], feasibility: [0, 1], urgency: [0, 10], effort: [0.1, 10000], risk: [0, 1], uncertainty: [0, 0.75]};

/** Project 6 only receives explicit, reviewed PM estimates and server-owned evidence links. */
export function rankOpportunities(run, input) {
  if (!Array.isArray(input.assessments) || !input.assessments.length || input.assessments.length > run.opportunities.length) throw new Error('Provide reviewed opportunity assessments');
  const seen = new Set();
  const scored = input.assessments.map(a => {
    const source = run.opportunities.find(o => o.id === a.id);
    if (!source || seen.has(a.id)) throw new Error('Unknown or duplicate opportunity ID');
    seen.add(a.id);
    if (a.reviewed !== true) throw new Error('Explicit human review is required');
    const values = Object.fromEntries(Object.entries(ranges).map(([key, [min, max]]) => [key, number(a[key], key, min, max)]));
    const dependencies = a.dependencies ?? [];
    if (!Array.isArray(dependencies) || dependencies.some(id => typeof id !== 'string')) throw new Error('dependencies must be an array of opportunity IDs');
    return {...source, ...values, title: requireText(a.title, 'opportunity title', 200), owner: requireText(a.owner, 'owner', 100), rationale: requireText(a.rationale, 'rationale'), dependencies: [...new Set(dependencies)]};
  });
  const byId = new Map(scored.map(o => [o.id, o]));
  const complete = new Set();
  const visit = (id, trail = new Set()) => {
    if (!byId.has(id)) throw new Error(`Dependency ${id} needs an assessment`);
    if (trail.has(id)) throw new Error('Dependency cycle detected');
    if (complete.has(id)) return;
    const next = new Set([...trail, id]);
    for (const dep of byId.get(id).dependencies) visit(dep, next);
    complete.add(id);
  };
  scored.forEach(o => visit(o.id));
  const capacity = number(input.capacity, 'capacity', 0.1, 100000);
  const ranking = prioritize(scored, {capacity, simulate: false});
  ranking.ranked = ranking.ranked.map(o => ({...o, evidenceIds: byId.get(o.id).evidenceIds, rationale: byId.get(o.id).rationale}));
  return {...run, stage: 'prioritized', ranking};
}
