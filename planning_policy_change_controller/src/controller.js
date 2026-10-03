const required = (value, name, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
};
const timestamp = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
};
const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
};
const finite = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
};
const semver = (value, name) => {
  const version = required(value, name, 40);
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`${name} must be a semantic version`);
  return {value, parts: match.slice(1).map(Number)};
};
const greaterVersion = (next, current) => next.parts.some((value, index) => value > current.parts[index] && next.parts.slice(0, index).every((part, i) => part === current.parts[i]));
const check = (id, passed, detail) => ({id, passed, detail});

function normalizeActive(raw, index, asOf) {
  const id = required(raw.id, `Active policy ${index + 1} id`, 80);
  const version = semver(raw.version, `${id} version`).value;
  const activatedAt = timestamp(raw.activatedAt, `${id} activatedAt`);
  if (Date.parse(activatedAt) > Date.parse(asOf)) throw new Error(`${id} cannot be active after asOf`);
  if (!Array.isArray(raw.scope) || !raw.scope.length || raw.scope.length > 100) throw new Error(`${id} scope must contain 1–100 team identifiers`);
  return {id, name: required(raw.name, `${id} name`, 160), version, activatedAt, scope: [...new Set(raw.scope.map(value => required(value, `${id} scope`, 80)))]};
}

function normalizeProposal(raw, index, context) {
  const id = required(raw.id, `Proposal ${index + 1} id`, 80);
  const outcomeReviewId = required(raw.outcomeReviewId, `${id} outcomeReviewId`, 80);
  const outcome = context.outcomes.get(outcomeReviewId);
  if (!outcome) throw new Error(`${id} must reference a Project 33 outcome review`);
  const policyId = required(raw.policyId, `${id} policyId`, 80);
  const active = context.active.get(policyId);
  if (!active) throw new Error(`${id} must reference an active policy baseline`);
  const from = semver(raw.fromVersion, `${id} fromVersion`);
  const to = semver(raw.toVersion, `${id} toVersion`);
  if (from.value !== active.version) throw new Error(`${id} fromVersion must match the active policy`);
  const scopes = Array.isArray(raw.scope) ? [...new Set(raw.scope.map(value => required(value, `${id} scope`, 80)))] : [];
  if (!scopes.length || scopes.some(scope => !active.scope.includes(scope))) throw new Error(`${id} scope must be a non-empty subset of the active policy scope`);
  const effectiveAt = timestamp(raw.effectiveAt, `${id} effectiveAt`);
  if (Date.parse(effectiveAt) <= Date.parse(context.asOf)) throw new Error(`${id} effectiveAt must be after asOf`);
  if (!Array.isArray(raw.rolloutSteps) || raw.rolloutSteps.length < 2 || raw.rolloutSteps.length > 10) throw new Error(`${id} requires 2–10 rollout steps`);
  let previous = 0;
  const rolloutSteps = raw.rolloutSteps.map((step, stepIndex) => {
    const percent = integer(step.percent, `${id} rollout step ${stepIndex + 1} percent`, 1, 100);
    if (percent <= previous) throw new Error(`${id} rollout percentages must increase`);
    previous = percent;
    return {percent, minimumDays: integer(step.minimumDays, `${id} rollout step ${stepIndex + 1} minimumDays`, 1, 90)};
  });
  if (rolloutSteps[0].percent === 100 || rolloutSteps.at(-1).percent !== 100) throw new Error(`${id} rollout must begin below and finish at 100 percent`);
  if (!Array.isArray(raw.monitors) || raw.monitors.length < 2 || raw.monitors.length > 20) throw new Error(`${id} requires 2–20 monitors`);
  const monitorNames = new Set();
  const monitors = raw.monitors.map((monitor, monitorIndex) => {
    const name = required(monitor.name, `${id} monitor ${monitorIndex + 1} name`, 120);
    if (monitorNames.has(name)) throw new Error(`${id} monitor names must be unique`);
    monitorNames.add(name);
    const direction = required(monitor.direction, `${id} ${name} direction`, 10);
    if (!['above', 'below'].includes(direction)) throw new Error(`${id} ${name} direction is invalid`);
    return {name, direction, threshold: finite(monitor.threshold, `${id} ${name} threshold`), windowHours: integer(monitor.windowHours, `${id} ${name} windowHours`, 1, 720)};
  });
  const rollback = raw.rollback ?? {};
  const triggerMonitors = [...new Set(rollback.triggerMonitors ?? [])];
  if (!triggerMonitors.length || triggerMonitors.some(name => !monitorNames.has(name))) throw new Error(`${id} rollback must reference declared monitors`);
  const roles = new Set(); const reviewers = new Set();
  if (!Array.isArray(raw.approvals) || raw.approvals.length < 3 || raw.approvals.length > 6) throw new Error(`${id} requires 3–6 approvals`);
  const approvals = raw.approvals.map((approval, approvalIndex) => {
    const role = required(approval.role, `${id} approval ${approvalIndex + 1} role`, 30);
    const reviewer = required(approval.reviewer, `${id} ${role} reviewer`, 120);
    if (roles.has(role) || reviewers.has(reviewer)) throw new Error(`${id} approval roles and reviewers must be unique`);
    roles.add(role); reviewers.add(reviewer);
    const decision = required(approval.decision, `${id} ${role} decision`, 20);
    if (!['approved', 'rejected'].includes(decision)) throw new Error(`${id} ${role} decision is invalid`);
    const reviewedAt = timestamp(approval.reviewedAt, `${id} ${role} reviewedAt`);
    if (Date.parse(reviewedAt) > Date.parse(context.asOf)) throw new Error(`${id} approval cannot occur after asOf`);
    return {role, reviewer, decision, reviewedAt};
  });
  const reviewDecision = required(raw.review?.decision, `${id} review decision`, 20);
  if (!['approve', 'revise', 'defer'].includes(reviewDecision)) throw new Error(`${id} review decision is invalid`);
  const reviewer = required(raw.review?.reviewer, `${id} review reviewer`, 120);
  const reviewAt = timestamp(raw.review?.reviewedAt, `${id} review reviewedAt`);
  if (Date.parse(reviewAt) > Date.parse(context.asOf)) throw new Error(`${id} review cannot occur after asOf`);
  const checks = [
    check('verified-outcome', outcome.status === 'verified_adopt' && outcome.review?.decision === 'adopt', 'Project 33 must verify the referenced adopt decision.'),
    check('version-advance', greaterVersion(to, from), `${from.value} must advance to a higher semantic version.`),
    check('progressive-rollout', rolloutSteps[0].percent < 100 && rolloutSteps.at(-1).percent === 100, 'Rollout starts with a limited cohort and ends at 100%.'),
    check('monitoring', monitors.length >= 2, 'At least two bounded monitors are declared.'),
    check('rollback', rollback.targetVersion === from.value && triggerMonitors.length > 0, 'Rollback restores the active version and is connected to monitors.'),
    check('enablement-evidence', Boolean(raw.evidence?.training && raw.evidence?.communication), 'Training and communication evidence are recorded.'),
    check('independent-approval', ['product', 'operations', 'governance'].every(role => roles.has(role)) && approvals.every(approval => approval.decision === 'approved') && !reviewers.has(raw.owner), 'Product, Operations, and Governance independently approve.'),
  ];
  const allPassed = checks.every(item => item.passed);
  return {
    id, outcomeReviewId, policyId, policyName: active.name, owner: required(raw.owner, `${id} owner`, 120),
    fromVersion: from.value, toVersion: to.value, scope: scopes, description: required(raw.description, `${id} description`, 1000), effectiveAt,
    rolloutSteps, monitors,
    rollback: {owner: required(rollback.owner, `${id} rollback owner`, 120), targetVersion: required(rollback.targetVersion, `${id} rollback targetVersion`, 40), procedure: required(rollback.procedure, `${id} rollback procedure`, 1000), maximumDecisionHours: integer(rollback.maximumDecisionHours, `${id} rollback maximumDecisionHours`, 1, 168), triggerMonitors},
    evidence: {training: required(raw.evidence?.training, `${id} training evidence`, 1000), communication: required(raw.evidence?.communication, `${id} communication evidence`, 1000)},
    approvals, checks,
    status: reviewDecision === 'approve' ? (allPassed ? 'ready_to_activate' : 'blocked_activation') : 'action_required',
    review: {reviewer, decision: reviewDecision, rationale: required(raw.review.rationale, `${id} review rationale`, 1000), reviewedAt: reviewAt},
  };
}

export function controlPlanningPolicyChanges(runs, outcomeReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (outcomeReport?.schemaVersion !== '1.0.0' || !Array.isArray(outcomeReport.outcomes)) throw new Error('Provide a Project 33 planning policy outcome report');
  const asOf = timestamp(input.asOf, 'asOf');
  if (Date.parse(outcomeReport.asOf) > Date.parse(asOf)) throw new Error('Project 33 report occurs after asOf');
  if (!Array.isArray(input.activePolicies) || !input.activePolicies.length || input.activePolicies.length > 100) throw new Error('Provide 1–100 active policy baselines');
  const activePolicies = input.activePolicies.map((policy, index) => normalizeActive(policy, index, asOf));
  if (new Set(activePolicies.map(policy => policy.id)).size !== activePolicies.length) throw new Error('Active policy IDs must be unique');
  if (!Array.isArray(input.proposals) || !input.proposals.length || input.proposals.length > 50) throw new Error('Provide 1–50 policy change proposals');
  const context = {asOf, active: new Map(activePolicies.map(policy => [policy.id, policy])), outcomes: new Map(outcomeReport.outcomes.map(outcome => [outcome.id, outcome]))};
  const proposals = input.proposals.map((proposal, index) => normalizeProposal(proposal, index, context));
  if (new Set(proposals.map(proposal => proposal.id)).size !== proposals.length) throw new Error('Proposal IDs must be unique');
  if (new Set(proposals.map(proposal => proposal.policyId)).size !== proposals.length) throw new Error('Only one pending proposal is allowed per active policy');
  const summary = proposals.reduce((result, proposal) => { result[proposal.status]++; return result; }, {ready_to_activate: 0, blocked_activation: 0, action_required: 0});
  return {
    schemaVersion: '1.0.0', asOf, sourcePolicyOutcomeAsOf: outcomeReport.asOf,
    sourceOutcomeReviewIds: proposals.map(proposal => proposal.outcomeReviewId),
    status: summary.blocked_activation ? 'blocked_activation' : summary.action_required ? 'action_required' : 'ready_to_activate',
    summary: {proposals: proposals.length, ...summary}, activePolicies, proposals,
    method: 'deterministic version, scope, progressive-rollout, monitoring, rollback, enablement, and independent-approval checks; this controller never activates or rolls back a planning policy',
  };
}

