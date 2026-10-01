import test from 'node:test';
import assert from 'node:assert/strict';
import {planPolicyExperiments} from '../src/planner.js';

const calibration = (overrides = {}) => ({
  schemaVersion: '1.0.0',
  asOf: '2027-07-02T00:00:00Z',
  status: 'blocked_acceptance',
  sourceOutcomeReviewIds: ['outcome-1'],
  checks: [
    {id: 'effort-bias', passed: false, detail: '0.4; allowed ±0.2'},
    {id: 'on-time-delivery', passed: false, detail: '0.5; minimum 0.8'},
    {id: 'evidence-coverage', passed: true, detail: '1'},
  ],
  ...overrides,
});

const candidate = (overrides = {}) => ({
  id: 'policy-1',
  title: 'Trial calibrated effort ranges',
  owner: 'Product operations lead',
  effort: 2,
  covers: ['effort-bias'],
  dependencies: [],
  policyArea: 'estimation',
  hypothesis: 'Using reference-class ranges will reduce absolute effort bias.',
  changeDescription: 'Use a reviewed range alongside point estimates for one planning cycle.',
  successMetric: 'Absolute effort bias is at or below 0.2.',
  guardrail: 'No more than one day is added to planning lead time.',
  rollbackPlan: 'Restore the prior estimation template after the review.',
  reversible: true,
  startsAt: '2027-07-10T00:00:00Z',
  reviewAt: '2027-08-10T00:00:00Z',
  minimumObservationDays: 30,
  ...overrides,
});

const input = (overrides = {}) => ({
  asOf: '2027-07-03T00:00:00Z',
  capacity: 4,
  minimumCoverageRate: 1,
  candidates: [candidate(), candidate({id: 'policy-2', title: 'Trial planning buffer review', covers: ['on-time-delivery'], policyArea: 'delivery'})],
  review: {
    reviewer: 'Product operating council',
    decision: 'approve',
    rationale: 'The reversible trials cover both observed planning gaps within capacity.',
    reviewedAt: '2027-07-03T00:00:00Z',
  },
  ...overrides,
});

const plan = (report = calibration(), value = input()) => planPolicyExperiments([], report, value);

test('approves reversible experiments that cover every calibration gap', () => {
  const result = plan();
  assert.equal(result.status, 'approved');
  assert.equal(result.summary.coverageRate, 1);
  assert.deepEqual(result.sourceOutcomeReviewIds, ['outcome-1']);
});

test('derives transparent risk points only from failed checks', () => {
  const result = plan();
  assert.equal(result.summary.calibrationGaps, 2);
  assert.equal(result.summary.totalRiskPoints, 12);
});

test('selects the highest unique coverage within capacity', () => {
  const candidates = [
    candidate({id: 'effort', effort: 2}),
    candidate({id: 'delivery', effort: 2, covers: ['on-time-delivery'], policyArea: 'delivery'}),
    candidate({id: 'both', effort: 3, covers: ['effort-bias', 'on-time-delivery'], policyArea: 'cross_cutting'}),
  ];
  const result = plan(calibration(), input({capacity: 3, candidates}));
  assert.deepEqual(result.selectedExperiments.map(item => item.id), ['both']);
  assert.equal(result.objective.optimal, true);
});

test('does not double count a gap covered by two experiments', () => {
  const report = calibration({checks: [{id: 'effort-bias', passed: false, detail: 'failed'}]});
  const candidates = [candidate({id: 'a', effort: 1}), candidate({id: 'b', effort: 1})];
  const result = plan(report, input({capacity: 2, candidates}));
  assert.equal(result.summary.coveredRiskPoints, 6);
  assert.equal(result.selectedExperiments.length, 1);
});

test('enforces candidate dependencies', () => {
  const report = calibration({checks: [{id: 'effort-bias', passed: false, detail: 'failed'}]});
  const candidates = [candidate({id: 'prepare', effort: 1}), candidate({id: 'trial', effort: 1, dependencies: ['prepare']})];
  const result = plan(report, input({capacity: 2, candidates}));
  assert.deepEqual(result.selectedExperiments.map(item => item.id), ['prepare']);
});

test('blocks approval below the declared coverage threshold', () => {
  const result = plan(calibration(), input({capacity: 0}));
  assert.equal(result.status, 'blocked_approval');
  assert.equal(result.summary.uncovered, 2);
});

test('keeps revise and defer as named human actions', () => {
  for (const decision of ['revise', 'defer']) {
    assert.equal(plan(calibration(), input({review: {...input().review, decision}})).status, 'action_required');
  }
});

test('returns no gaps without inventing experiments', () => {
  const report = calibration({status: 'calibrated', checks: [{id: 'effort-bias', passed: true, detail: '0'}]});
  const result = plan(report, input({candidates: []}));
  assert.equal(result.status, 'no_gaps');
  assert.equal(result.summary.totalRiskPoints, 0);
});

test('requires known failed gaps and compatible policy areas', () => {
  assert.throws(() => plan(calibration(), input({candidates: [candidate({covers: ['evidence-coverage']})]})), /known failed/);
  assert.throws(() => plan(calibration(), input({candidates: [candidate({policyArea: 'delivery'})]})), /does not match/);
});

test('requires reversible experiments with observation and rollback controls', () => {
  assert.throws(() => plan(calibration(), input({candidates: [candidate({reversible: false})]})), /explicitly reversible/);
  assert.throws(() => plan(calibration(), input({candidates: [candidate({rollbackPlan: ''})]})), /rollbackPlan/);
  assert.throws(() => plan(calibration(), input({candidates: [candidate({minimumObservationDays: 60})]})), /shorter/);
});

test('rejects invalid dates and dependencies', () => {
  assert.throws(() => plan(calibration(), input({candidates: [candidate({startsAt: '2027-07-01T00:00:00Z'})]})), /after asOf/);
  assert.throws(() => plan(calibration(), input({candidates: [candidate({dependencies: ['unknown']})]})), /invalid dependency/);
});

test('rejects malformed upstream reports, duplicates and unbounded candidates', () => {
  assert.throws(() => plan({}, input()), /Project 31/);
  assert.throws(() => plan(calibration(), input({candidates: [candidate(), candidate()]})), /unique/);
  assert.throws(() => plan(calibration(), input({candidates: new Array(17).fill(candidate())})), /at most 16/);
});

test('rejects future reports and reviews', () => {
  assert.throws(() => plan(calibration({asOf: '2027-08-01T00:00:00Z'}), input()), /after asOf/);
  assert.throws(() => plan(calibration(), input({review: {...input().review, reviewedAt: '2027-08-01T00:00:00Z'}})), /after asOf/);
});
