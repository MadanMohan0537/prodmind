const required = (value, name, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
};
const timestamp = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
};
const number = (value, name, max = 1e12) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${name} must be a number from 0 to ${max}`);
  return value;
};
const integer = (value, name, max = 1e9) => {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${name} must be an integer from 0 to ${max}`);
  return value;
};
const round = value => Number(value.toFixed(4));

export function reviewSunsetOutcomes(runs, sunsetReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  if (sunsetReport?.schemaVersion !== '1.0.0' || !Array.isArray(sunsetReport.snapshots)) throw new Error('Provide a Project 22 sunset report');
  if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 50) throw new Error('Provide 1–50 outcome reviews');
  const snapshots = new Map(sunsetReport.snapshots.map(item => [item.id, item]));
  const ids = new Set();

  const reviews = input.reviews.map((raw, index) => {
    const id = required(raw.id, `Review ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error('Review IDs must be unique');
    ids.add(id);
    const snapshotId = required(raw.snapshotId, `${id} snapshotId`, 80);
    const snapshot = snapshots.get(snapshotId);
    if (!snapshot) throw new Error(`Unknown sunset snapshot: ${snapshotId}`);
    const reviewedAt = timestamp(raw.reviewedAt, `${id} reviewedAt`);
    const observationWindowDays = Number.isInteger(raw.observationWindowDays) && raw.observationWindowDays >= 1 && raw.observationWindowDays <= 365 ? raw.observationWindowDays : 30;
    const windowEndsAt = new Date(new Date(snapshot.asOf).getTime() + observationWindowDays * 86_400_000).toISOString();

    const support = raw.support ?? {};
    const baselineContacts = integer(support.baselineContacts, `${id} baselineContacts`, 1e7);
    const observedContacts = integer(support.observedContacts, `${id} observedContacts`, 1e7);
    const maximumIncreaseRate = number(support.maximumIncreaseRate ?? 0.1, `${id} maximumIncreaseRate`, 10);
    const supportIncreaseRate = baselineContacts === 0 ? (observedContacts === 0 ? 0 : 1) : (observedContacts - baselineContacts) / baselineContacts;

    const incidents = raw.incidents ?? {};
    const critical = integer(incidents.critical ?? 0, `${id} critical incidents`, 10000);
    const customerImpacting = integer(incidents.customerImpacting ?? 0, `${id} customer-impacting incidents`, 10000);
    const maximumCritical = integer(incidents.maximumCritical ?? 0, `${id} maximumCritical`, 10000);
    const maximumCustomerImpacting = integer(incidents.maximumCustomerImpacting ?? 0, `${id} maximumCustomerImpacting`, 10000);
    const residualTrafficCount = integer(raw.residualTrafficCount, `${id} residualTrafficCount`, 1e12);

    const economics = raw.economics ?? {};
    const expectedMonthlySavings = number(economics.expectedMonthlySavings, `${id} expectedMonthlySavings`);
    const observedMonthlySavings = number(economics.observedMonthlySavings, `${id} observedMonthlySavings`);
    const minimumRealizationRate = number(economics.minimumRealizationRate ?? 0.8, `${id} minimumRealizationRate`, 1);
    const realizationRate = expectedMonthlySavings === 0 ? (observedMonthlySavings === 0 ? 1 : 0) : observedMonthlySavings / expectedMonthlySavings;
    const currency = required(economics.currency, `${id} currency`, 10).toUpperCase();

    const rollbackRaw = raw.rollback ?? {};
    const rollback = {
      owner: required(rollbackRaw.owner, `${id} rollback owner`, 120),
      available: rollbackRaw.available === true,
      testedAt: timestamp(rollbackRaw.testedAt, `${id} rollback testedAt`),
      procedure: required(rollbackRaw.procedure, `${id} rollback procedure`, 1000),
      recoveryMinutes: integer(rollbackRaw.recoveryMinutes, `${id} recoveryMinutes`, 100000),
      maximumRecoveryMinutes: integer(rollbackRaw.maximumRecoveryMinutes, `${id} maximumRecoveryMinutes`, 100000),
    };

    const actions = (raw.correctiveActions ?? []).map((action, actionIndex) => {
      const status = required(action.status, `${id} action ${actionIndex + 1} status`, 20);
      if (!['open', 'closed'].includes(status)) throw new Error(`${id} corrective action status is invalid`);
      return {
        id: required(action.id, `${id} action ${actionIndex + 1} id`, 120),
        owner: required(action.owner, `${id} action ${actionIndex + 1} owner`, 120),
        description: required(action.description, `${id} action ${actionIndex + 1} description`, 1000),
        status,
        dueAt: timestamp(action.dueAt, `${id} action ${actionIndex + 1} dueAt`),
      };
    });
    if (actions.length > 50 || new Set(actions.map(action => action.id)).size !== actions.length) throw new Error(`${id} requires at most 50 unique corrective actions`);
    const decisionRaw = raw.decision ?? {};
    const choice = required(decisionRaw.choice, `${id} decision`, 30);
    if (!['close', 'extend_monitoring', 'restore_service'].includes(choice)) throw new Error(`${id} decision is invalid`);
    const decision = {
      choice,
      reviewer: required(decisionRaw.reviewer, `${id} decision reviewer`, 120),
      rationale: required(decisionRaw.rationale, `${id} decision rationale`, 1000),
      reviewedAt: timestamp(decisionRaw.reviewedAt, `${id} decision reviewedAt`),
    };
    const overdueOpenActions = actions.filter(action => action.status === 'open' && new Date(action.dueAt) < new Date(reviewedAt));
    const checks = [
      {id: 'upstream-ready', passed: snapshot.status === 'ready_for_human_sunset', detail: snapshot.status},
      {id: 'observation-window', passed: new Date(reviewedAt) >= new Date(windowEndsAt), detail: `ends ${windowEndsAt}`},
      {id: 'customer-support', passed: supportIncreaseRate <= maximumIncreaseRate, detail: `${round(supportIncreaseRate)} increase; limit ${maximumIncreaseRate}`},
      {id: 'incident-impact', passed: critical <= maximumCritical && customerImpacting <= maximumCustomerImpacting, detail: `${critical} critical; ${customerImpacting} customer-impacting`},
      {id: 'residual-traffic', passed: residualTrafficCount === 0, detail: `${residualTrafficCount} requests`},
      {id: 'savings-realization', passed: realizationRate >= minimumRealizationRate, detail: `${round(realizationRate)} realized; minimum ${minimumRealizationRate}`},
      {id: 'reversibility', passed: rollback.available && rollback.recoveryMinutes <= rollback.maximumRecoveryMinutes, detail: `${rollback.recoveryMinutes} of ${rollback.maximumRecoveryMinutes} minutes`},
      {id: 'corrective-actions', passed: overdueOpenActions.length === 0, detail: `${overdueOpenActions.length} overdue open`},
    ];
    const failedChecks = checks.filter(check => !check.passed).map(check => check.id);
    const status = choice === 'close' ? (failedChecks.length ? 'blocked_close' : 'closed') : 'action_required';
    return {
      id, snapshotId, planId: snapshot.planId, journeyId: snapshot.journeyId, releaseId: snapshot.releaseId,
      portfolioItemId: snapshot.portfolioItemId, title: snapshot.title, action: snapshot.action,
      sunsetAt: snapshot.sunsetAt, evidenceIds: [...snapshot.evidenceIds], shipDecisionIds: [...snapshot.shipDecisionIds],
      assumptionIds: [...snapshot.assumptionIds], reviewedAt, observationWindowDays, windowEndsAt,
      support: {baselineContacts, observedContacts, maximumIncreaseRate, increaseRate: round(supportIncreaseRate)},
      incidents: {critical, customerImpacting, maximumCritical, maximumCustomerImpacting}, residualTrafficCount,
      economics: {expectedMonthlySavings, observedMonthlySavings, minimumRealizationRate, realizationRate: round(realizationRate), currency},
      rollback, correctiveActions: actions, decision, checks, failedChecks, status,
    };
  });

  return {
    schemaVersion: '1.0.0',
    summary: {
      reviews: reviews.length,
      closed: reviews.filter(review => review.status === 'closed').length,
      actionRequired: reviews.filter(review => review.status === 'action_required').length,
      blockedClose: reviews.filter(review => review.status === 'blocked_close').length,
      overdueActions: reviews.reduce((count, review) => count + review.correctiveActions.filter(action => action.status === 'open' && new Date(action.dueAt) < new Date(review.reviewedAt)).length, 0),
    },
    reviews,
    method: 'deterministic post-sunset outcome and reversibility checks over Project 22 evidence; savings are observed-versus-expected comparisons, not causal attribution; no service is closed or restored',
  };
}
