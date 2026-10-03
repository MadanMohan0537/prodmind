import assert from 'node:assert/strict';
import test from 'node:test';
import {controlPlanningPolicyChanges} from '../src/controller.js';

const outcome = {id:'outcome-1',status:'verified_adopt',review:{decision:'adopt'}};
const report = {schemaVersion:'1.0.0',asOf:'2027-08-02T00:00:00.000Z',outcomes:[outcome]};
const active = {id:'sampling-policy',name:'Outcome sampling policy',version:'1.0.0',activatedAt:'2027-01-01T00:00:00Z',scope:['alpha','beta']};
const proposal = {
  id:'change-1',outcomeReviewId:'outcome-1',policyId:'sampling-policy',owner:'Product operations owner',fromVersion:'1.0.0',toVersion:'1.1.0',scope:['alpha'],description:'Use a larger outcome sample for planning calibration.',effectiveAt:'2027-08-10T00:00:00Z',
  rolloutSteps:[{percent:20,minimumDays:7},{percent:100,minimumDays:14}],
  monitors:[{name:'decision latency',direction:'above',threshold:7,windowHours:168},{name:'sample completeness',direction:'below',threshold:.95,windowHours:168}],
  rollback:{owner:'Operations lead',targetVersion:'1.0.0',procedure:'Restore policy version 1.0.0 and notify affected teams.',maximumDecisionHours:24,triggerMonitors:['decision latency']},
  evidence:{training:'Facilitator training record 12.',communication:'Team acknowledgement record 14.'},
  approvals:['product','operations','governance'].map((role,index)=>({role,reviewer:`Independent ${index}`,decision:'approved',reviewedAt:'2027-08-03T00:00:00Z'})),
  review:{reviewer:'Change council',decision:'approve',rationale:'The verified trial has a bounded and reversible adoption plan.',reviewedAt:'2027-08-03T00:00:00Z'},
};
const input = overrides => ({asOf:'2027-08-03T00:00:00Z',activePolicies:[active],proposals:[{...proposal,...overrides}]});

test('marks a complete verified change ready to activate',()=>{
  const result=controlPlanningPolicyChanges([],report,input());
  assert.equal(result.status,'ready_to_activate'); assert.equal(result.summary.ready_to_activate,1);
  assert.deepEqual(result.sourceOutcomeReviewIds,['outcome-1']); assert.ok(result.proposals[0].checks.every(item=>item.passed));
});
test('blocks an unverified Project 33 outcome',()=>assert.equal(controlPlanningPolicyChanges([],{...report,outcomes:[{...outcome,status:'blocked_adopt'}]},input()).status,'blocked_activation'));
test('blocks a non-increasing version',()=>assert.equal(controlPlanningPolicyChanges([],report,input({toVersion:'1.0.0'})).status,'blocked_activation'));
test('requires the active version as baseline',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,input({fromVersion:'0.9.0'})),/active policy/));
test('requires a progressive rollout ending at 100 percent',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,input({rolloutSteps:[{percent:100,minimumDays:1},{percent:100,minimumDays:1}]})),/increase/));
test('requires rollback to the active version',()=>assert.equal(controlPlanningPolicyChanges([],report,input({rollback:{...proposal.rollback,targetVersion:'0.9.0'}})).status,'blocked_activation'));
test('requires rollback triggers to reference monitors',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,input({rollback:{...proposal.rollback,triggerMonitors:['unknown']}})),/declared monitors/));
test('requires training and communication evidence',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,input({evidence:{training:'done'}})),/communication/));
test('blocks rejected independent approval',()=>{const approvals=proposal.approvals.map((item,index)=>index?item:{...item,decision:'rejected'});assert.equal(controlPlanningPolicyChanges([],report,input({approvals})).status,'blocked_activation');});
test('keeps revise as a named human action',()=>assert.equal(controlPlanningPolicyChanges([],report,input({review:{...proposal.review,decision:'revise'}})).status,'action_required'));
test('rejects scope outside the active policy',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,input({scope:['gamma']})),/subset/));
test('rejects duplicate proposals for one policy',()=>assert.throws(()=>controlPlanningPolicyChanges([],report,{...input(),proposals:[proposal,{...proposal,id:'change-2'}]}),/one pending/));
test('rejects malformed upstream reports and future baselines',()=>{assert.throws(()=>controlPlanningPolicyChanges([],{},input()),/Project 33/);assert.throws(()=>controlPlanningPolicyChanges([],report,{...input(),activePolicies:[{...active,activatedAt:'2028-01-01T00:00:00Z'}]}),/after asOf/);});

