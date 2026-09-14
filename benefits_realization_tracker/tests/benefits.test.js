import test from 'node:test';
import assert from 'node:assert/strict';
import {trackBenefits} from '../src/benefits.js';

const runs=[{id:'run-1',title:'Onboarding',ranking:{portfolio:{selected:['opp-1']},ranked:[{id:'opp-1',title:'Improve onboarding',evidenceIds:['f-1','f-2']},{id:'opp-2',title:'Not selected',evidenceIds:['f-3']}]},experiments:[{id:'exp-1',opportunityId:'opp-1',decision:{id:'dec-1'},outcomeReviews:[{id:'review-1'}]}]}];
const benefit=(overrides={})=>({id:'activation',portfolioItemId:'run-1:opp-1',name:'Activation rate',unit:'percentage_points',direction:'increase',baseline:40,target:50,actual:48,baselineAt:'2026-01-01',targetAt:'2026-03-01',measuredAt:'2026-02-15',owner:'Growth PM',attributionNote:'Reviewed alongside the controlled experiment; other releases may contribute.',...overrides});

test('tracks progress and preserves complete evidence lineage',()=>{const result=trackBenefits(runs,{benefits:[benefit()],asOf:'2026-02-20'});assert.equal(result.benefits[0].progress,.8);assert.equal(result.benefits[0].status,'on_track');assert.deepEqual(result.benefits[0].evidenceIds,['f-1','f-2']);assert.deepEqual(result.benefits[0].decisionIds,['dec-1']);assert.deepEqual(result.benefits[0].outcomeReviewIds,['review-1'])});
test('handles decrease targets',()=>{const result=trackBenefits(runs,{benefits:[benefit({direction:'decrease',baseline:10,target:5,actual:4})]});assert.equal(result.benefits[0].progress,1.2);assert.equal(result.benefits[0].status,'realized')});
test('flags overdue unmeasured benefits',()=>{const result=trackBenefits(runs,{benefits:[benefit({actual:null,measuredAt:null,targetAt:'2026-02-01'})],asOf:'2026-02-20'});assert.equal(result.benefits[0].status,'overdue')});
test('marks final measurements below target',()=>{const result=trackBenefits(runs,{benefits:[benefit({actual:45,measuredAt:'2026-03-01'})],asOf:'2026-03-01'});assert.equal(result.benefits[0].status,'below_target')});
test('does not combine incompatible units',()=>{const result=trackBenefits(runs,{benefits:[benefit(),benefit({id:'minutes',name:'Time to value',unit:'minutes',direction:'decrease',baseline:20,target:10,actual:15})]});assert.deepEqual(result.units.map(item=>item.unit),['minutes','percentage_points']);assert.ok(!('totalValue' in result.summary))});
test('rejects unselected or unknown portfolio items',()=>assert.throws(()=>trackBenefits(runs,{benefits:[benefit({portfolioItemId:'run-1:opp-2'})]}),/Unknown selected/));
test('rejects invalid target direction and duplicate IDs',()=>{assert.throws(()=>trackBenefits(runs,{benefits:[benefit({target:30})]}),/declared direction/);assert.throws(()=>trackBenefits(runs,{benefits:[benefit(),benefit()]}),/unique/)});
