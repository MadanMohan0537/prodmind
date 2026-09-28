import test from 'node:test';
import assert from 'node:assert/strict';
import {planControlImprovements} from '../src/planner.js';

const recurrence = (overrides = {}) => ({
  schemaVersion: '1.0.0',
  surveillance: [{
    id: 'surveillance-1',
    exitReviewId: 'exit-1',
    governancePackId: 'pack-1',
    portfolioItemId: 'run-1:opportunity-1',
    title: 'Onboarding control',
    evidenceIds: ['feedback-1'],
    recurrenceCount: 1,
    firstRecurrenceAt: '2027-05-01T00:00:00Z',
    failedChecks: ['target-stable'],
    ...overrides,
  }],
});

const candidate = (overrides = {}) => ({
  id: 'improvement-1',
  title: 'Prevent digest drift',
  owner: 'Platform lead',
  effort: 3,
  covers: ['surveillance-1'],
  dependencies: [],
  response: 'prevent',
  dueAt: '2027-06-01T00:00:00Z',
  successMetric: 'No recurrence in three weekly snapshots.',
  verificationWindowDays: 30,
  ...overrides,
});

const input = (overrides = {}) => ({
  asOf: '2027-05-10T00:00:00Z',
  capacity: 3,
  minimumCoverageRate: 1,
  candidates: [candidate()],
  review: {
    reviewer: 'Governance council',
    decision: 'approve',
    rationale: 'The plan covers the current recurrence within capacity.',
    reviewedAt: '2027-05-10T00:00:00Z',
  },
  ...overrides,
});

test('approves a fully covered recurrence plan and preserves lineage', () => {
  const result = planControlImprovements([], recurrence(), input());
  assert.equal(result.status, 'approved');
  assert.equal(result.summary.coverageRate, 1);
  assert.deepEqual(result.coveredTargets[0].evidenceIds, ['feedback-1']);
});

test('derives risk points from recurrence and failed checks', () => {
  const result = planControlImprovements([], recurrence(), input());
  assert.equal(result.summary.totalRiskPoints, 20);
  assert.equal(result.summary.coveredRiskPoints, 20);
});

test('selects the highest unique risk coverage within capacity', () => {
  const report = recurrence();
  report.surveillance.push({...report.surveillance[0], id: 'surveillance-2', recurrenceCount: 2, failedChecks: ['target-stable', 'lineage-continuity']});
  const candidates = [
    candidate(),
    candidate({id: 'improvement-2', covers: ['surveillance-2'], effort: 3}),
  ];
  const result = planControlImprovements([], report, input({candidates}));
  assert.deepEqual(result.selectedActions.map(item => item.id), ['improvement-2']);
  assert.equal(result.objective.optimal, true);
});

test('does not double count one finding covered by multiple actions', () => {
  const candidates = [candidate({id: 'a', effort: 1}), candidate({id: 'b', effort: 1})];
  const result = planControlImprovements([], recurrence(), input({capacity: 2, candidates}));
  assert.equal(result.summary.coveredRiskPoints, 20);
  assert.equal(result.selectedActions.length, 1);
});

test('enforces dependencies during optimization', () => {
  const candidates = [
    candidate({id: 'diagnose', effort: 1, response: 'detect'}),
    candidate({id: 'prevent', effort: 1, dependencies: ['diagnose']}),
  ];
  const result = planControlImprovements([], recurrence(), input({capacity: 2, candidates}));
  assert.deepEqual(result.selectedActions.map(item => item.id), ['diagnose']);
});

test('blocks approval below the declared coverage threshold', () => {
  const result = planControlImprovements([], recurrence(), input({capacity: 0}));
  assert.equal(result.status, 'blocked_approval');
  assert.equal(result.summary.uncovered, 1);
});

test('keeps revise and defer as named human actions', () => {
  for (const decision of ['revise', 'defer']) {
    const review = {...input().review, decision};
    assert.equal(planControlImprovements([], recurrence(), input({review})).status, 'action_required');
  }
});

test('returns no findings honestly without inventing improvement work', () => {
  const report = recurrence({recurrenceCount: 0, failedChecks: [], firstRecurrenceAt: null});
  const result = planControlImprovements([], report, input({candidates: []}));
  assert.equal(result.status, 'no_findings');
  assert.equal(result.summary.totalRiskPoints, 0);
});

test('rejects unknown findings and invalid dependencies', () => {
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate({covers: ['unknown']})]})), /known actionable/);
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate({dependencies: ['unknown']})]})), /invalid dependency/);
});

test('rejects duplicate candidate IDs and unbounded candidate sets', () => {
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate(), candidate()]})), /unique/);
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: new Array(17).fill(candidate())})), /at most 16/);
});

test('rejects missing owners, invalid dates, and invalid responses', () => {
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate({owner: ''})]})), /owner/);
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate({dueAt: '2027-05-01T00:00:00Z'})]})), /after asOf/);
  assert.throws(() => planControlImprovements([], recurrence(), input({candidates: [candidate({response: 'ignore'})]})), /response/);
});

test('rejects malformed upstream reports and future reviews', () => {
  assert.throws(() => planControlImprovements([], {}, input()), /Project 28/);
  const review = {...input().review, reviewedAt: '2027-05-11T00:00:00Z'};
  assert.throws(() => planControlImprovements([], recurrence(), input({review})), /after asOf/);
});

