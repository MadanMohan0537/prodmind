import {audit} from './audit.js';
import {requireText, number} from './pipeline.js';

const date = (value, name) => {
  requireText(value, name, 40);
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${name} must be a real UTC timestamp with milliseconds`);
  return new Date(value).toISOString();
};

export function addExperiment(run, input, now = new Date().toISOString()) {
  if (run.experiments.length >= 20) throw new Error('Maximum 20 experiments per discovery run');
  const opportunity = run.ranking?.ranked.find(o => o.id === input.opportunityId);
  if (!opportunity || !run.ranking.portfolio.selected.includes(opportunity.id)) throw new Error('Select an assessed opportunity in the capacity portfolio');
  const plan = {
    hypothesis: requireText(input.hypothesis, 'hypothesis'),
    control: requireText(input.control, 'control'), treatment: requireText(input.treatment, 'treatment'),
    primaryMetric: requireText(input.primaryMetric, 'primaryMetric', 200),
    conversionDefinition: requireText(input.conversionDefinition, 'conversionDefinition'),
    owner: requireText(input.owner, 'owner', 100),
    startsAt: date(input.startsAt, 'startsAt'), endsAt: date(input.endsAt, 'endsAt'),
    minimumPerArm: number(input.minimumPerArm, 'minimumPerArm', 1, 4000),
    sampleSizeRationale: requireText(input.sampleSizeRationale, 'sampleSizeRationale'),
    mode: input.mode ?? 'prospective',
    guardrails: input.guardrails,
  };
  if (!Number.isInteger(plan.minimumPerArm)) throw new Error('minimumPerArm must be an integer');
  if (plan.control === plan.treatment) throw new Error('Control and treatment must differ');
  if (!['prospective', 'retrospective'].includes(plan.mode)) throw new Error('Unknown experiment mode');
  const duration = Date.parse(plan.endsAt) - Date.parse(plan.startsAt);
  if (duration < 86400000 || duration > 90 * 86400000) throw new Error('Plan a 1–90 day observation window');
  if (!Array.isArray(plan.guardrails) || !plan.guardrails.length || plan.guardrails.length > 10) throw new Error('Define 1–10 guardrails');
  plan.guardrails = plan.guardrails.map(g => ({name: requireText(g.name, 'guardrail name', 100), criterion: requireText(g.criterion, 'guardrail acceptance criterion', 500)}));
  if (new Set(plan.guardrails.map(g => g.name)).size !== plan.guardrails.length) throw new Error('Guardrail names must be unique');
  const experiment = {id: crypto.randomUUID(), opportunityId: opportunity.id, evidenceIds: [...opportunity.evidenceIds], opportunitySnapshot: structuredClone(opportunity), plan, status: 'draft', createdAt: now, audits: [], decision: null};
  return {...run, stage: 'experimenting', experiments: [...run.experiments, experiment]};
}

function update(run, id, change) {
  if (!run.experiments.some(e => e.id === id)) throw new Error('Experiment not found in this discovery run');
  return {...run, experiments: run.experiments.map(e => e.id === id ? change(structuredClone(e)) : e)};
}

export function startExperiment(run, id, now = new Date().toISOString()) {
  return update(run, id, e => {
    if (e.status !== 'draft') throw new Error('Only draft experiments can be started');
    if (e.plan.mode === 'prospective' && Date.parse(now) > Date.parse(e.plan.startsAt)) throw new Error('A prospective plan must be locked before exposure begins');
    e.status = 'running'; e.lockedAt = now;
    return e;
  });
}

export function recordReadout(run, id, input, now = new Date().toISOString()) {
  return update(run, id, e => {
    if (!['running', 'review'].includes(e.status)) throw new Error('Lock the plan before submitting events; decided experiments cannot be reopened');
    if (e.audits.length >= 20) throw new Error('Maximum 20 readouts per experiment');
    if (input.experiment_id !== id) throw new Error('Event envelope must reference this experiment ID');
    const report = audit(input);
    for (const [index, event] of input.events.entries()) {
      const time = Date.parse(event?.timestamp);
      if (Number.isFinite(time) && (time < Date.parse(e.plan.startsAt) || time > Date.parse(e.plan.endsAt) || time > Date.parse(now))) {
        report.findings.push({code: 'outside_observation_window', row: index + 1, message: 'Event lies outside the locked observation window or is in the future'});
      }
    }
    if (report.findings.length) {report.status = 'blocked'; report.aggregate = null; report.explanation = 'Data defects or locked-window violations block aggregate release. Correct the source snapshot and rerun.';}
    const mature = Date.parse(now) >= Date.parse(e.plan.endsAt);
    const sampleComplete = report.aggregate ? ['control', 'treatment'].every(arm => report.aggregate[arm].visitors >= e.plan.minimumPerArm) : false;
    const readout = {id: crypto.randomUUID(), createdAt: now, report, mature, sampleComplete, decisionReady: report.status === 'pass' && mature && sampleComplete};
    if (report.aggregate) {
      readout.observedRates = Object.fromEntries(Object.entries(report.aggregate).map(([arm, counts]) => [arm, counts.conversions / counts.visitors]));
      readout.absoluteDifference = readout.observedRates.treatment - readout.observedRates.control;
    }
    readout.interpretation = 'Descriptive counts only. No significance, causal claim, SRM approval or automatic ship recommendation.';
    e.audits.push(readout); e.status = 'review';
    return e;
  });
}

export function recordDecision(run, id, input, now = new Date().toISOString()) {
  const next = update(run, id, e => {
    if (e.status !== 'review') throw new Error('An audited readout is required before a decision');
    const latest = e.audits.at(-1);
    if (input.auditId !== latest.id) throw new Error('Decision must reference the latest audit');
    if (!['ship', 'iterate', 'reject'].includes(input.outcome)) throw new Error('Choose ship, iterate or reject');
    if (!latest.decisionReady) throw new Error('Resolve data defects and complete the planned window and sample first');
    if (!Array.isArray(input.guardrailReviews) || input.guardrailReviews.length !== e.plan.guardrails.length) throw new Error('Review every predeclared guardrail');
    const names = new Set();
    const guardrails = input.guardrailReviews.map(g => {
      if (!e.plan.guardrails.some(p => p.name === g.name) || names.has(g.name) || typeof g.passed !== 'boolean') throw new Error('Invalid or duplicate guardrail review');
      names.add(g.name);
      return {name: g.name, passed: g.passed, evidence: requireText(g.evidence, 'guardrail evidence')};
    });
    if (input.outcome === 'ship' && (e.plan.mode !== 'prospective' || guardrails.some(g => !g.passed))) throw new Error('Shipping requires a prospective plan and passed guardrails');
    e.decision = {auditId: latest.id, outcome: input.outcome, reviewer: requireText(input.reviewer, 'reviewer', 100), rationale: requireText(input.rationale, 'decision rationale'), statisticalReview: requireText(input.statisticalReview, 'analyst review of significance, SRM and stopping rules'), guardrailReviews: guardrails, decidedAt: now, method: 'human-reviewed-not-automated-inference'};
    e.status = 'decided';
    return e;
  });
  return {...next, stage: 'learning'};
}

export function learningLedger(run) {
  return run.experiments.filter(e => e.decision).map(e => ({experimentId: e.id, opportunityId: e.opportunityId, evidenceIds: e.evidenceIds, decision: e.decision}));
}
