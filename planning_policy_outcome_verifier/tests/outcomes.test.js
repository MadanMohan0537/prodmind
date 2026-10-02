import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyPolicyExperimentOutcomes} from '../src/outcomes.js';

const experiment = {
  id: 'trial-1', startsAt: '2027-01-02T00:00:00.000Z', reviewAt: '2027-02-01T00:00:00.000Z', minimumObservationDays: 30,
  minimumSampleSize: 100, primaryMeasure: {name: 'On-time rate', unit: '%', direction: 'increase', baseline: 70, target: 80},
  guardrailMeasure: {name: 'Defect rate', unit: '%', direction: 'not_increase', baseline: 5, tolerance: 1},
};
const plan = {schemaVersion: '1.0.0', status: 'approved', asOf: '2027-01-01T00:00:00.000Z', selectedExperiments: [experiment], sourceOutcomeReviewIds: ['o-1']};
const review = {
  id: 'r-1', experimentId: 'trial-1', completedAt: '2027-02-01T00:00:00Z', sampleSize: 120,
  observedPrimary: 82, observedGuardrail: 5.5, deliveryEvidence: 'Release record', analysisEvidence: 'Analysis notebook',
  review: {reviewer: 'Product council', decision: 'adopt', rationale: 'All declared checks passed.', reviewedAt: '2027-02-02T00:00:00Z'},
};
const input = overrides => ({asOf: '2027-02-02T00:00:00Z', reviews: [{...review, ...overrides}]});

test('verifies an adoption only when every declared check passes', () => {
  const report = verifyPolicyExperimentOutcomes([], plan, input());
  assert.equal(report.status, 'verified_adopt');
  assert.equal(report.summary.verified_adopt, 1);
  assert.deepEqual(report.sourceOutcomeReviewIds, ['o-1']);
  assert.ok(report.outcomes[0].checks.every(item => item.passed));
});

test('blocks adoption below the primary target', () => {
  const report = verifyPolicyExperimentOutcomes([], plan, input({observedPrimary: 79}));
  assert.equal(report.status, 'blocked_adopt');
  assert.equal(report.outcomes[0].checks.find(item => item.id === 'primary-target').passed, false);
});

test('blocks adoption when a guardrail is breached', () => {
  const report = verifyPolicyExperimentOutcomes([], plan, input({observedGuardrail: 6.1}));
  assert.equal(report.status, 'blocked_adopt');
});

test('blocks adoption below the minimum sample', () => {
  assert.equal(verifyPolicyExperimentOutcomes([], plan, input({sampleSize: 99})).status, 'blocked_adopt');
});

test('blocks an early outcome review', () => {
  const early = {...review, completedAt: '2027-01-20T00:00:00Z', review: {...review.review, reviewedAt: '2027-01-20T00:00:00Z'}};
  const report = verifyPolicyExperimentOutcomes([], plan, {asOf: '2027-01-20T00:00:00Z', reviews: [early]});
  assert.equal(report.status, 'blocked_adopt');
  assert.equal(report.outcomes[0].checks.find(item => item.id === 'observation-window').passed, false);
});

test('returns action required for an extend decision', () => {
  const extended = {...review, review: {...review.review, decision: 'extend'}};
  assert.equal(verifyPolicyExperimentOutcomes([], plan, {asOf: '2027-02-02T00:00:00Z', reviews: [extended]}).status, 'action_required');
});

test('supports decrease targets and not-decrease guardrails', () => {
  const alternate = {...experiment, primaryMeasure: {...experiment.primaryMeasure, direction: 'decrease', baseline: 10, target: 8}, guardrailMeasure: {...experiment.guardrailMeasure, direction: 'not_decrease', baseline: 70, tolerance: 2}};
  const alternatePlan = {...plan, selectedExperiments: [alternate]};
  const alternateReview = {...review, observedPrimary: 7, observedGuardrail: 68};
  assert.equal(verifyPolicyExperimentOutcomes([], alternatePlan, {asOf: '2027-02-02T00:00:00Z', reviews: [alternateReview]}).status, 'verified_adopt');
});

test('rejects an unapproved source plan', () => assert.throws(() => verifyPolicyExperimentOutcomes([], {...plan, status: 'blocked_approval'}, input()), /must be approved/));
test('rejects unknown experiments', () => assert.throws(() => verifyPolicyExperimentOutcomes([], plan, input({experimentId: 'unknown'})), /selected Project 32/));
test('rejects duplicate review IDs', () => assert.throws(() => verifyPolicyExperimentOutcomes([], plan, {asOf: input().asOf, reviews: [review, review]}), /Review IDs/));
test('rejects duplicate experiment reviews', () => assert.throws(() => verifyPolicyExperimentOutcomes([], plan, {asOf: input().asOf, reviews: [review, {...review, id: 'r-2'}]}), /only one/));
test('rejects reviews after the assessment date', () => assert.throws(() => verifyPolicyExperimentOutcomes([], plan, input({review: {...review.review, reviewedAt: '2027-03-01T00:00:00Z'}})), /after asOf/));

