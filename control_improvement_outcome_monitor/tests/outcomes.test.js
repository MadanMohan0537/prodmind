import test from 'node:test';
import assert from 'node:assert/strict';
import {monitorImprovementOutcomes} from '../src/outcomes.js';

const target = {id:'source-1', exitReviewId:'exit-1', governancePackId:'pack-1', portfolioItemId:'run:opportunity', evidenceIds:['feedback-1']};
const action = {id:'action-1', title:'Prevent recurrence', owner:'Platform lead', response:'prevent', effort:3, covers:['source-1'], dueAt:'2027-06-01T00:00:00Z', successMetric:'Three stable weekly checks.', verificationWindowDays:30};
const plan = (overrides={}) => ({schemaVersion:'1.0.0', status:'approved', selectedActions:[action], coveredTargets:[target], ...overrides});
const followup = (overrides={}) => ({id:'followup-1', exitReviewId:'exit-1', governancePackId:'pack-1', portfolioItemId:'run:opportunity', asOf:'2027-06-25T00:00:00Z', status:'stable', recurrenceCount:0, failedChecks:[], ...overrides});
const recurrence = (items=[followup()]) => ({schemaVersion:'1.0.0', surveillance:items});
const review = (overrides={}) => ({id:'outcome-1', improvementActionId:'action-1', asOf:'2027-06-26T00:00:00Z', completedAt:'2027-05-20T00:00:00Z', actualEffort:3, minimumFollowups:1, followupSurveillanceIds:['followup-1'], deliveryEvidence:'Change record 42 deployed.', successEvidence:'Weekly control report shows no recurrence.', review:{reviewer:'Governance council',decision:'close',rationale:'Delivery and follow-up evidence satisfy the plan.',reviewedAt:'2027-06-26T00:00:00Z'}, ...overrides});
const run = (r=review(), p=plan(), later=recurrence(), variance=.25) => monitorImprovementOutcomes([],p,later,{maximumEffortVarianceRate:variance,reviews:[r]});

test('verifies an effective delivered improvement and preserves evidence lineage',()=>{const result=run();assert.equal(result.summary.verifiedEffective,1);assert.deepEqual(result.reviews[0].evidenceIds,['feedback-1'])});
test('blocks closure when later recurrence returns',()=>{const result=run(review(),plan(),recurrence([followup({status:'blocked_keep_closed',recurrenceCount:1,failedChecks:['target-stable']})]));assert.equal(result.summary.blockedClose,1);assert.ok(result.reviews[0].failedChecks.includes('recurrence-reduced'))});
test('requires an approved Project 29 plan',()=>{const result=run(review(),plan({status:'blocked_approval'}));assert.ok(result.reviews[0].failedChecks.includes('plan-approved'))});
test('requires enough later surveillance',()=>{const result=run(review({minimumFollowups:2}));assert.ok(result.reviews[0].failedChecks.includes('followup-coverage'))});
test('requires a complete verification window',()=>{const result=run(review({completedAt:'2027-06-10T00:00:00Z'}));assert.ok(result.reviews[0].failedChecks.includes('verification-window'))});
test('detects late delivery',()=>{const result=run(review({completedAt:'2027-06-02T00:00:00Z'}));assert.ok(result.reviews[0].failedChecks.includes('completed-on-time'))});
test('detects effort beyond declared tolerance',()=>{const result=run(review({actualEffort:5}));assert.ok(result.reviews[0].failedChecks.includes('effort-within-tolerance'))});
test('requires matching later lineage',()=>{const result=run(review(),plan(),recurrence([followup({portfolioItemId:'other'})]));assert.ok(result.reviews[0].failedChecks.includes('lineage-continuity'))});
test('keeps continue and escalate as named human actions',()=>{for(const decision of['continue','escalate']){const raw=review();raw.review.decision=decision;assert.equal(run(raw).reviews[0].status,'action_required')}});
test('rejects actions not selected by Project 29',()=>{assert.throws(()=>run(review({improvementActionId:'missing'})),/Unknown selected/)});
test('rejects duplicate review IDs and invalid follow-up timing',()=>{assert.throws(()=>monitorImprovementOutcomes([],plan(),recurrence(),{maximumEffortVarianceRate:.25,reviews:[review(),review()]}),/unique/);assert.throws(()=>run(review(),plan(),recurrence([followup({asOf:'2027-05-10T00:00:00Z'})])),/after completion/)});
test('rejects malformed reports and invalid variance',()=>{assert.throws(()=>monitorImprovementOutcomes([],{},recurrence(),{maximumEffortVarianceRate:.25,reviews:[review()]}),/Project 29/);assert.throws(()=>run(review(),plan(),recurrence(),6),/from 0 to 5/)});

