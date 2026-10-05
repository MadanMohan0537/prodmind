import assert from 'node:assert/strict';
import test from 'node:test';
import {monitorPlanningPolicyEffectiveness} from '../src/effectiveness.js';

const experiment = {
  id: 'experiment-1',
  primaryMeasure: {name: 'decision accuracy', unit: 'rate', direction: 'increase', baseline: 0.7, target: 0.8},
  guardrailMeasure: {name: 'decision latency', unit: 'days', direction: 'not_increase', baseline: 5, tolerance: 2},
  minimumSampleSize: 100,
};
const policyPlan = {schemaVersion: '1.0.0', asOf: '2027-07-01T00:00:00.000Z', selectedExperiments: [experiment]};
const outcome = {id: 'outcome-1', experimentId: 'experiment-1', status: 'verified_adopt', review: {decision: 'adopt'}};
const outcomeReport = {schemaVersion: '1.0.0', asOf: '2027-08-02T00:00:00.000Z', outcomes: [outcome]};
const rollout = {
  id: 'rollout-1', proposalId: 'change-1', outcomeReviewId: 'outcome-1', policyId: 'policy-1', toVersion: '1.1.0',
  status: 'verified_rollout', review: {decision: 'continue'},
  snapshots: [{id: 'stage-1', observedAt: '2027-08-10T00:00:00.000Z'}, {id: 'stage-2', observedAt: '2027-08-17T00:00:00.000Z'}],
};
const rolloutReport = {schemaVersion: '1.0.0', asOf: '2027-08-31T00:00:00.000Z', rollouts: [rollout]};
const review = {
  id: 'effectiveness-1', rolloutId: 'rollout-1',
  observations: [
    {id: 'o1', observedAt: '2027-08-24T00:00:00Z', version: '1.1.0', sampleSize: 130, observedPrimary: 0.84, observedGuardrail: 5.5, evidence: 'Weekly metrics export 1.'},
    {id: 'o2', observedAt: '2027-08-31T00:00:00Z', version: '1.1.0', sampleSize: 150, observedPrimary: 0.82, observedGuardrail: 6, evidence: 'Weekly metrics export 2.'},
  ],
  review: {reviewer: 'Planning council', decision: 'retain', rationale: 'The policy remains effective and inside its guardrail.', reviewedAt: '2027-08-31T00:00:00Z'},
};
const input = overrides => ({asOf: '2027-08-31T00:00:00Z', minimumSustainmentDays: 14, maximumSnapshotGapDays: 7, reviews: [{...review, ...overrides}]});

test('verifies sustained effectiveness with complete lineage', () => {
  const result = monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input());
  assert.equal(result.status, 'sustained_effectiveness');
  assert.deepEqual(result.sourcePolicyRolloutIds, ['rollout-1']);
  assert.deepEqual(result.sourcePolicyChangeIds, ['change-1']);
  assert.deepEqual(result.sourceOutcomeReviewIds, ['outcome-1']);
  assert.deepEqual(result.sourcePolicyExperimentIds, ['experiment-1']);
  assert.ok(result.policyReviews[0].checks.every(item => item.passed));
});

test('blocks retention when Project 35 did not verify the rollout', () => {
  const report = {...rolloutReport, rollouts: [{...rollout, status: 'blocked_continue'}]};
  assert.equal(monitorPlanningPolicyEffectiveness([], report, policyPlan, outcomeReport, input()).status, 'blocked_retain');
});

test('rejects broken Project 33 and Project 32 lineage', () => {
  const report = {...rolloutReport, rollouts: [{...rollout, outcomeReviewId: 'missing'}]};
  assert.throws(() => monitorPlanningPolicyEffectiveness([], report, policyPlan, outcomeReport, input()), /Project 33/);
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, {schemaVersion:'1.0.0',asOf:policyPlan.asOf,selectedExperiments:[]}, outcomeReport, input()), /Project 32/);
});

test('rejects observations at or before rollout completion', () => {
  const observations = [{...review.observations[0], observedAt: '2027-08-17T00:00:00Z'}, review.observations[1]];
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({observations})), /follow rollout completion/);
});

test('blocks the wrong policy version', () => {
  const observations = review.observations.map((item, index) => index ? {...item, version: '1.0.0'} : item);
  assert.equal(monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({observations})).status, 'blocked_retain');
});

test('blocks insufficient samples', () => {
  const observations = review.observations.map((item, index) => index ? {...item, sampleSize: 99} : item);
  assert.equal(monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({observations})).status, 'blocked_retain');
});

test('detects primary-target regression', () => {
  const observations = review.observations.map((item, index) => index ? {...item, observedPrimary: 0.79} : item);
  const result = monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({observations}));
  assert.equal(result.status, 'blocked_retain');
  assert.equal(result.policyReviews[0].drift.targetRegressionDetected, true);
});

test('detects guardrail regression', () => {
  const observations = review.observations.map((item, index) => index ? {...item, observedGuardrail: 7.1} : item);
  const result = monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({observations}));
  assert.equal(result.status, 'blocked_retain');
  assert.equal(result.policyReviews[0].drift.guardrailRegressionDetected, true);
});

test('blocks an incomplete sustainment window', () => {
  assert.equal(monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), minimumSustainmentDays: 15}).status, 'blocked_retain');
});

test('blocks observation cadence gaps', () => {
  assert.equal(monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), maximumSnapshotGapDays: 6}).status, 'blocked_retain');
});

test('keeps adjust and revert as human actions', () => {
  for (const decision of ['adjust', 'revert']) {
    const result = monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({review: {...review.review, decision}}));
    assert.equal(result.status, 'action_required');
  }
});

test('supports decrease targets and not-decrease guardrails', () => {
  const changed = {...experiment, primaryMeasure:{...experiment.primaryMeasure,direction:'decrease',baseline:10,target:8},guardrailMeasure:{...experiment.guardrailMeasure,direction:'not_decrease',baseline:.9,tolerance:.05}};
  const plan = {...policyPlan, selectedExperiments:[changed]};
  const observations = review.observations.map(item => ({...item, observedPrimary:7.5, observedGuardrail:.88}));
  assert.equal(monitorPlanningPolicyEffectiveness([], rolloutReport, plan, outcomeReport, input({observations})).status, 'sustained_effectiveness');
});

test('rejects duplicate reviews and rollout assessments', () => {
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), reviews:[review, review]}), /IDs must be unique/);
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), reviews:[review, {...review,id:'effectiveness-2'}]}), /only one/);
});

test('rejects reviews before observations or after asOf', () => {
  const early = {...review.review, reviewedAt:'2027-08-30T00:00:00Z'};
  const late = {...review.review, reviewedAt:'2027-09-01T00:00:00Z'};
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({review:early})), /must follow/);
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, input({review:late})), /not exceed/);
});

test('rejects malformed upstream reports and invalid policy bounds', () => {
  assert.throws(() => monitorPlanningPolicyEffectiveness([], {}, policyPlan, outcomeReport, input()), /Project 35/);
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), minimumSustainmentDays: 1}), /7 to 365/);
  assert.throws(() => monitorPlanningPolicyEffectiveness([], rolloutReport, policyPlan, outcomeReport, {...input(), maximumSnapshotGapDays: 0}), /1 to 90/);
});
