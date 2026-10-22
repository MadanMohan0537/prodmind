import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {discover, rankOpportunities} from '../src/pipeline.js';
import {addExperiment, startExperiment, recordReadout, recordDecision, recordOutcomeReview, learningLedger} from '../src/lifecycle.js';
import {RunStore, Conflict} from '../src/store.js';
import worker from '../src/product-worker.js';

const now = '2026-09-05T00:00:00.000Z';
const later = '2026-09-09T00:00:00.000Z';
const fixture = () => ({title:'Onboarding discovery',...JSON.parse(readFileSync(new URL('../public/sample-feedback.json',import.meta.url)))});
const assessment = o => ({id:o.id,title:'Improve onboarding',reviewed:true,businessValue:7,userValue:8,strategicAlignment:7,confidence:0.8,feasibility:0.8,urgency:5,effort:2,risk:0.2,uncertainty:0.2,owner:'Test PM',rationale:'Synthetic assessment for tests only',dependencies:[]});
const plan = opportunityId => ({opportunityId,hypothesis:'A checklist improves setup completion',control:'Existing flow',treatment:'Checklist',primaryMetric:'Setup completion',conversionDefinition:'One setup-complete event per exposed user',owner:'Test PM',startsAt:'2026-09-06T00:00:00.000Z',endsAt:'2026-09-08T00:00:00.000Z',minimumPerArm:1,sampleSizeRationale:'Tiny fixture for tests, not powered inference',guardrails:[{name:'Support rate',criterion:'No material increase'}]});
const events = id => ({experiment_id:id,events:[
  {event_id:'e1',user_id:'u1',experiment_id:id,type:'exposure',variant:'control',timestamp:'2026-09-06T00:00:00.000Z'},
  {event_id:'e2',user_id:'u2',experiment_id:id,type:'exposure',variant:'treatment',timestamp:'2026-09-06T00:00:00.000Z'},
  {event_id:'e3',user_id:'u2',experiment_id:id,type:'conversion',variant:'treatment',timestamp:'2026-09-07T00:00:00.000Z'},
]});
async function ranked() {const run=await discover(fixture(),now);return rankOpportunities(run,{assessments:[assessment(run.opportunities[0])],capacity:5});}
async function started() {let run=await ranked();run=addExperiment(run,plan(run.ranking.ranked[0].id),now);return startExperiment(run,run.experiments[0].id,now);}
const decision = run => ({auditId:run.experiments[0].audits.at(-1).id,outcome:'iterate',reviewer:'Test analyst',rationale:'Need a powered experiment',statisticalReview:'Insufficient power; iterate, do not infer a winner',guardrailReviews:[{name:'Support rate',passed:true,evidence:'Synthetic test evidence'}]});
const monitoring = () => ({title:'Onboarding outcome',metric:{name:'Activation',unit:'rate'},direction:'increase',targetChange:.05,baseline:['2026-08-01','2026-08-02','2026-08-03'].map((day,i)=>({period:`${day}T00:00:00.000Z`,value:.3+i*.01})),observed:['2026-09-04','2026-09-05','2026-09-06'].map(day=>({period:`${day}T00:00:00.000Z`,value:.35})),guardrails:[{name:'Support rate',kind:'maximum',threshold:.2,current:.1}],owner:'Test PM',reviewCadence:'weekly'});

test('projects 1–8 connect with original evidence IDs and a monitored learning result',async()=>{
  let run=await started();
  const id=run.experiments[0].id;
  assert.equal(run.dashboard.summary.totalFeedback,run.evidence.length);
  assert.ok(run.evidence.every(e=>e.sentiment.model&&e.detection.model&&e.topicId));
  assert.ok(run.ranking.ranked.every(o=>o.evidenceIds.every(id=>run.evidence.some(e=>e.id===id))));
  run=recordReadout(run,id,events(id),later);
  assert.equal(run.experiments[0].audits[0].decisionReady,true);
  run=recordDecision(run,id,decision(run),later);
  assert.equal(run.stage,'learning');
  assert.deepEqual(learningLedger(run)[0].evidenceIds,run.experiments[0].evidenceIds);
  run=recordOutcomeReview(run,id,monitoring(),'2026-09-12T00:00:00.000Z');
  assert.equal(run.stage,'monitoring');
  assert.equal(learningLedger(run)[0].outcomeReviews[0].decisionId,run.experiments[0].decision.id);
  assert.deepEqual(learningLedger(run)[0].outcomeReviews[0].evidenceIds,run.experiments[0].evidenceIds);
});
test('distinct customers with identical text retain both evidence records',async()=>{
  const input=fixture();input.records[1].text=input.records[0].text;
  const run=await discover(input,now);assert.equal(run.evidence.length,4);assert.equal(run.duplicateCandidates.length,1);
});
test('duplicate source IDs fail instead of confusing joins',async()=>{
  const input=fixture();input.records[1].id=input.records[0].id;await assert.rejects(()=>discover(input,now),/Duplicate/);
});
test('future feedback and missing timestamps fail',async()=>{
  const input=fixture();input.records[0].timestamp=later;await assert.rejects(()=>discover(input,now),/future/);
  delete input.records[0].timestamp;await assert.rejects(()=>discover(input,now),/timestamp/);
});
test('rank requires explicit PM review and all scoring fields',async()=>{
  const run=await discover(fixture(),now);const a=assessment(run.opportunities[0]);delete a.businessValue;
  assert.throws(()=>rankOpportunities(run,{assessments:[a],capacity:5}),/businessValue/);
  a.businessValue=7;a.reviewed=false;assert.throws(()=>rankOpportunities(run,{assessments:[a],capacity:5}),/review/);
});
test('cycles rejected before invoking legacy portfolio selector',async()=>{
  const run=await discover(fixture(),now);const a=assessment(run.opportunities[0]);a.dependencies=[a.id];
  assert.throws(()=>rankOpportunities(run,{assessments:[a],capacity:5}),/cycle/);
});
test('supplied evidence IDs cannot replace source lineage',async()=>{
  const run=await discover(fixture(),now);const a={...assessment(run.opportunities[0]),evidenceIds:['forged']};
  const result=rankOpportunities(run,{assessments:[a],capacity:5});assert.ok(!result.ranking.ranked[0].evidenceIds.includes('forged'));
});
test('unknown or unselected opportunity cannot create experiment',async()=>{
  const run=await ranked();assert.throws(()=>addExperiment(run,plan('missing'),now),/Select/);
});
test('prospective experiment cannot be backdated',async()=>{
  const run=await ranked();const draft=addExperiment(run,plan(run.ranking.ranked[0].id),now);
  assert.throws(()=>startExperiment(draft,draft.experiments[0].id,later),/before exposure/);
});
test('bad events withhold counts and prevent human decision',async()=>{
  let run=await started();const id=run.experiments[0].id;const input=events(id);input.events.push({...input.events[0]});
  run=recordReadout(run,id,input,later);assert.equal(run.experiments[0].audits[0].report.aggregate,null);
  assert.throws(()=>recordDecision(run,id,decision(run),later),/defects/);
});
test('observation-window violations block export',async()=>{
  let run=await started();const id=run.experiments[0].id;const input=events(id);input.events[2].timestamp=later;
  run=recordReadout(run,id,input,later);assert.equal(run.experiments[0].audits[0].report.aggregate,null);
});
test('immature observation period cannot produce a decision',async()=>{
  let run=await started();const id=run.experiments[0].id;
  run=recordReadout(run,id,events(id),'2026-09-07T12:00:00.000Z');assert.equal(run.experiments[0].audits[0].decisionReady,false);
});
test('readout must match experiment ID',async()=>{
  const run=await started();assert.throws(()=>recordReadout(run,run.experiments[0].id,events('different'),later),/envelope/);
});
test('stale audit and missing guardrail review are rejected',async()=>{
  let run=await started();const id=run.experiments[0].id;run=recordReadout(run,id,events(id),later);
  assert.throws(()=>recordDecision(run,id,{...decision(run),auditId:'old'},later),/latest/);
  assert.throws(()=>recordDecision(run,id,{...decision(run),guardrailReviews:[]},later),/every/);
});
test('retrospective plans can record learning but cannot approve shipping',async()=>{
  let run=await ranked();run=addExperiment(run,{...plan(run.ranking.ranked[0].id),mode:'retrospective'},later);
  const id=run.experiments[0].id;run=startExperiment(run,id,later);run=recordReadout(run,id,events(id),later);
  assert.throws(()=>recordDecision(run,id,{...decision(run),outcome:'ship'},later),/prospective/);
  assert.equal(recordDecision(run,id,decision(run),later).experiments[0].status,'decided');
});
test('decided experiments are immutable',async()=>{
  let run=await started();const id=run.experiments[0].id;run=recordReadout(run,id,events(id),later);run=recordDecision(run,id,decision(run),later);
  assert.throws(()=>recordReadout(run,id,events(id),later),/reopened/);
});

function database(t) {
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_product_runs.sql',import.meta.url),'utf8'));t.after(()=>sql.close());
  return {sql,prepare(query){const stmt=sql.prepare(query);let params=[];return {bind(...values){params=values;return this;},async run(){const r=stmt.run(...params);return {meta:{changes:Number(r.changes)}};},async first(){return stmt.get(...params)??null;},async all(){return {results:stmt.all(...params)};}};}};
}
test('real SQLite migration persists run and transactional version journal',async t=>{
  const db=database(t);const store=new RunStore(db);const run=await discover(fixture(),now);
  await store.create(run);assert.deepEqual(await store.get(run.id),run);
  const next=await store.save({...run,stage:'prioritized'},1);assert.equal(next.version,2);
  await assert.rejects(()=>store.save(run,1),Conflict);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM product_run_history').get().n,2);
  assert.equal((await store.list()).length,1);
});
const requestBodies=new Map();
const req=(path,body,token='secret')=>{if(body)requestBodies.set(path,body);return new Request(`https://prodmind.test${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});};
test('HTTP discovery -> ranking -> draft -> reload uses real persisted records',async t=>{
  const env={DB:database(t),API_TOKEN:'secret'};
  let response=await worker.fetch(req('/api/runs',fixture()),env);assert.equal(response.status,201);let run=await response.json();
  response=await worker.fetch(req(`/api/runs/${run.id}/rank`,{version:run.version,capacity:5,assessments:[assessment(run.opportunities[0])]}),env);assert.equal(response.status,200);run=await response.json();
  response=await worker.fetch(req(`/api/runs/${run.id}/experiments`,{...plan(run.ranking.ranked[0].id),version:run.version}),env);assert.equal(response.status,200);run=await response.json();
  const reloaded=await (await worker.fetch(req(`/api/runs/${run.id}`),env)).json();assert.equal(reloaded.experiments[0].id,run.experiments[0].id);
});
test('HTTP rejects stale revision and fails closed without DB or auth',async t=>{
  const env={DB:database(t),API_TOKEN:'secret'};
  const run=await(await worker.fetch(req('/api/runs',fixture()),env)).json();
  assert.equal((await worker.fetch(req(`/api/runs/${run.id}/rank`,{version:0}),env)).status,409);
  assert.equal((await worker.fetch(req('/api/runs'),{API_TOKEN:'secret'})).status,503);
  assert.equal((await worker.fetch(req('/api/runs',null,'bad'),env)).status,401);
});

test('HTTP complete lifecycle persists learning and survives reopening the store',async t=>{
  const env={DB:database(t),API_TOKEN:'secret'};
  let run=await(await worker.fetch(req('/api/runs',fixture()),env)).json();
  const post=async(path,payload)=>{
    const response=await worker.fetch(req(`/api/runs/${run.id}/${path}`,{...payload,version:run.version}),env);
    const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));run=result;
  };
  await post('rank',{capacity:5,assessments:[assessment(run.opportunities[0])]});
  await post('experiments',{...plan(run.ranking.ranked[0].id),startsAt:'2026-09-01T00:00:00.000Z',endsAt:'2026-09-03T00:00:00.000Z',mode:'retrospective'});
  const id=run.experiments[0].id;
  await post(`experiments/${id}/start`,{});
  const snapshot=events(id);snapshot.events.forEach(e=>e.timestamp=e.type==='conversion'?'2026-09-02T00:00:00.000Z':'2026-09-01T00:00:00.000Z');
  await post(`experiments/${id}/readout`,snapshot);
  await post(`experiments/${id}/decision`,decision(run));
  await post(`learning/${id}/monitor`,monitoring());
  const reopened=await new RunStore(env.DB).get(run.id);
  const ledger=await(await worker.fetch(req(`/api/runs/${run.id}/learning`),env)).json();
  const memory=await(await worker.fetch(req('/api/memory?q=onboarding'),env)).json();
  const calibration=await(await worker.fetch(req('/api/calibration'),env)).json();
  const integrity=await(await worker.fetch(req('/api/evidence-integrity'),env)).json();
  const researchPlan=await(await worker.fetch(req('/api/research-plan?capacity=4'),env)).json();
  const strategy={id:'test-strategy',objectives:[{id:'activation',title:'Improve activation',targetShare:1,minShare:.8,maxShare:1}],mappings:[{opportunityId:run.ranking.ranked[0].id,objectiveId:'activation'}]};
  const strategyAudit=await(await worker.fetch(req('/api/strategy-audit',strategy),env)).json();
  const rebalance=await(await worker.fetch(req('/api/portfolio-rebalance',{strategy,capacity:5,lockedOpportunityIds:[run.ranking.ranked[0].id]}),env)).json();
  const roadmapScheduleInput={strategy,capacity:5,lockedOpportunityIds:[run.ranking.ranked[0].id],roadmapScheduleId:'roadmap-1',roadmapAsOf:'2027-01-03T00:00:00Z',roadmapHorizonStart:'2027-01-04',roadmapMaximumHorizonDays:30,roadmapWorkingWeekdays:[1,2,3,4,5],roadmapNonWorkingDates:[],roadmapTeams:[{id:'product-team',name:'Product team',capacity:10}],roadmapPlans:rebalance.selected.map(item=>({portfolioItemId:item.portfolioItemId,teamId:'product-team',durationDays:1,capacity:1,earliestStart:'2027-01-04',deadline:'2027-01-08',owner:'Product lead',outcome:`Deliver ${item.title}.`,estimateBasis:'Reviewed against a comparable one-day delivery.'})),roadmapReview:{reviewer:'Portfolio council',decision:'approve',rationale:'Evidence, dependencies, capacity and dates are reviewable.',reviewedAt:'2027-01-03T00:00:00Z'}};
  const roadmapSchedule=await(await worker.fetch(req('/api/roadmap-schedule',roadmapScheduleInput),env)).json();
  const roadmapDeliveryInput={...roadmapScheduleInput,deliveryMonitorId:'delivery-1',deliveryAsOf:'2027-01-04T20:00:00Z',deliveryMinimumSnapshots:1,deliveryMaximumSnapshotGapDays:3,deliveryMinimumSchedulePerformanceIndex:.9,deliveryMaximumCapacityOverrunRate:.2,deliverySnapshots:[{id:'delivery-snapshot-1',observedAt:'2027-01-04T18:00:00Z',items:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,status:'completed',completedWorkUnits:item.durationDays*item.capacity,actualCapacityDays:item.durationDays*item.capacity,remainingEstimateDays:0,actualStart:item.start,actualFinish:item.finish,evidence:'Reviewed delivery board export.',blockers:[]}))}],deliveryReview:{reviewer:'Delivery council',decision:'continue',rationale:'Delivery evidence, dependencies, capacity, and deadlines are controlled.',reviewedAt:'2027-01-04T19:00:00Z'}};
  const roadmapDelivery=await(await worker.fetch(req('/api/roadmap-delivery',roadmapDeliveryInput),env)).json();
  const historicalSchedule={...roadmapSchedule,id:'roadmap-historical'};
  const historicalDelivery={...roadmapDelivery,id:'delivery-historical',sourceScheduleId:'roadmap-historical'};
  const roadmapCalibration=await(await worker.fetch(req('/api/roadmap-estimate-calibration',{...roadmapDeliveryInput,calibrationHistoricalCases:[{scheduleReport:historicalSchedule,deliveryReport:historicalDelivery,classifications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',basis:'Same reviewed product-delivery shape and team model.'}))}],calibrationCurrentClassifications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',basis:'Current reviewed product-delivery case.'})),roadmapCalibrationId:'roadmap-calibration-1',roadmapCalibrationAsOf:'2027-02-01T00:00:00Z',roadmapCalibrationMinimumReferenceClassSize:2,roadmapCalibrationPercentileRate:.8,roadmapCalibrationMaximumEvidenceAgeDays:90,roadmapCalibrationReview:{reviewer:'Portfolio council',decision:'adopt',rationale:'The comparable class has sufficient fresh delivery evidence.',reviewedAt:'2027-02-01T01:00:00Z'}}),env)).json();
  const estimateAdoptionCase=name=>{const scheduleReport={...roadmapSchedule,id:`estimate-history-${name}`,asOf:'2026-11-30T00:00:00Z',schedule:roadmapSchedule.schedule.map(item=>({...item,start:'2026-12-01',finish:'2026-12-01',deadline:'2026-12-02'})),review:{reviewer:`Historical roadmap council ${name}`}};return {scheduleReport,deliveryReport:{schemaVersion:'1.0.0',id:`estimate-delivery-${name}`,asOf:'2026-12-02T00:00:00Z',sourceScheduleId:scheduleReport.id,items:scheduleReport.schedule.map(item=>({portfolioItemId:item.portfolioItemId,status:'completed',actualStart:item.start,actualFinish:item.finish,actualCapacityDays:item.durationDays*item.capacity,deadlineMet:true,evidence:`Reviewed historical delivery record ${name}.`}))},classifications:scheduleReport.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',basis:'Same selected product-work delivery shape and team model.'}))};};
  const roadmapEstimateAdoption=await(await worker.fetch(req('/api/roadmap-estimate-adoption',{...roadmapScheduleInput,estimateAdoptionCalibrationCases:[estimateAdoptionCase('one'),estimateAdoptionCase('two')],estimateAdoptionCalibrationId:'estimate-adoption-calibration-1',estimateAdoptionCalibrationAsOf:'2027-01-02T00:00:00Z',estimateAdoptionCalibrationMinimumReferenceClassSize:2,estimateAdoptionCalibrationPercentileRate:.8,estimateAdoptionCalibrationMaximumEvidenceAgeDays:90,estimateAdoptionCalibrationReview:{reviewer:'Historical calibration council',decision:'adopt',rationale:'The reference class has two fresh comparable outcomes.',reviewedAt:'2027-01-02T01:00:00Z'},estimateAdoptionControlId:'estimate-adoption-control-1',estimateAdoptionControlAsOf:'2027-01-03T12:00:00Z',estimateAdoptionMaximumCalibrationAgeDays:30,estimateAdoptionRoundingToleranceDays:0,estimateAdoptionCapacityToleranceRate:0,estimateAdoptionApplications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',baseDurationDays:item.durationDays,baseCapacityDays:item.durationDays*item.capacity,appliedDurationFactor:1,appliedCapacityFactor:1,estimateBasis:'Applied the adopted selected-product-work factors to the reviewed base estimate.',evidence:'Estimate worksheet preserves base values, factor arithmetic, and evidence lineage.'})),estimateAdoptionReview:{reviewer:'Investment committee',decision:'approve',rationale:'Every scheduled estimate reconciles to the prior adopted calibration.',reviewedAt:'2027-01-03T13:00:00Z'}}),env)).json();
  const roadmapEstimateEffectiveness=await(await worker.fetch(req('/api/roadmap-estimate-effectiveness',{...roadmapDeliveryInput,estimateAdoptionCalibrationCases:[estimateAdoptionCase('one'),estimateAdoptionCase('two')],estimateAdoptionCalibrationId:'estimate-adoption-calibration-1',estimateAdoptionCalibrationAsOf:'2027-01-02T00:00:00Z',estimateAdoptionCalibrationMinimumReferenceClassSize:2,estimateAdoptionCalibrationPercentileRate:.8,estimateAdoptionCalibrationMaximumEvidenceAgeDays:90,estimateAdoptionCalibrationReview:{reviewer:'Historical calibration council',decision:'adopt',rationale:'The reference class has two fresh comparable outcomes.',reviewedAt:'2027-01-02T01:00:00Z'},estimateAdoptionControlId:'estimate-adoption-control-1',estimateAdoptionControlAsOf:'2027-01-03T12:00:00Z',estimateAdoptionMaximumCalibrationAgeDays:30,estimateAdoptionRoundingToleranceDays:0,estimateAdoptionCapacityToleranceRate:0,estimateAdoptionApplications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',baseDurationDays:item.durationDays,baseCapacityDays:item.durationDays*item.capacity,appliedDurationFactor:1,appliedCapacityFactor:1,estimateBasis:'Applied the adopted selected-product-work factors to the reviewed base estimate.',evidence:'Estimate worksheet preserves base values, factor arithmetic, and evidence lineage.'})),estimateAdoptionReview:{reviewer:'Investment committee',decision:'approve',rationale:'Every scheduled estimate reconciles to the prior adopted calibration.',reviewedAt:'2027-01-03T13:00:00Z'},estimateEffectivenessId:'estimate-effectiveness-1',estimateEffectivenessAsOf:'2027-01-05T00:00:00Z',estimateEffectivenessMaximumDurationErrorRate:0,estimateEffectivenessMaximumCapacityErrorRate:0,estimateEffectivenessMinimumErrorReductionRate:0,estimateEffectivenessOutcomes:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,actualDurationDays:item.durationDays,evidence:'Reviewed workday record confirms active delivery days.'})),estimateEffectivenessReview:{reviewer:'Estimation council',decision:'retain',rationale:'Completed outcomes match the governed estimates and retain source evidence.',reviewedAt:'2027-01-05T01:00:00Z'}}),env)).json();
  const estimateDriftHistoricalReport=(id,asOf)=>({...roadmapEstimateEffectiveness,id,asOf,sourceScheduleId:`schedule-${id}`,sourceDeliveryId:`delivery-${id}`,sourceAdoptionId:`adoption-${id}`,items:roadmapEstimateEffectiveness.items.map(item=>({...item,portfolioItemId:`${item.portfolioItemId}-${id}`}))});
  const roadmapEstimateDrift=await(await worker.fetch(req('/api/roadmap-estimate-drift',{...roadmapDeliveryInput,estimateAdoptionCalibrationCases:[estimateAdoptionCase('one'),estimateAdoptionCase('two')],estimateAdoptionCalibrationId:'estimate-adoption-calibration-1',estimateAdoptionCalibrationAsOf:'2027-01-02T00:00:00Z',estimateAdoptionCalibrationMinimumReferenceClassSize:2,estimateAdoptionCalibrationPercentileRate:.8,estimateAdoptionCalibrationMaximumEvidenceAgeDays:90,estimateAdoptionCalibrationReview:{reviewer:'Historical calibration council',decision:'adopt',rationale:'The reference class has two fresh comparable outcomes.',reviewedAt:'2027-01-02T01:00:00Z'},estimateAdoptionControlId:'estimate-adoption-control-1',estimateAdoptionControlAsOf:'2027-01-03T12:00:00Z',estimateAdoptionMaximumCalibrationAgeDays:30,estimateAdoptionRoundingToleranceDays:0,estimateAdoptionCapacityToleranceRate:0,estimateAdoptionApplications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',baseDurationDays:item.durationDays,baseCapacityDays:item.durationDays*item.capacity,appliedDurationFactor:1,appliedCapacityFactor:1,estimateBasis:'Applied the adopted selected-product-work factors to the reviewed base estimate.',evidence:'Estimate worksheet preserves base values, factor arithmetic, and evidence lineage.'})),estimateAdoptionReview:{reviewer:'Investment committee',decision:'approve',rationale:'Every scheduled estimate reconciles to the prior adopted calibration.',reviewedAt:'2027-01-03T13:00:00Z'},estimateEffectivenessId:'estimate-effectiveness-1',estimateEffectivenessAsOf:'2027-01-05T00:00:00Z',estimateEffectivenessMaximumDurationErrorRate:0,estimateEffectivenessMaximumCapacityErrorRate:0,estimateEffectivenessMinimumErrorReductionRate:0,estimateEffectivenessOutcomes:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,actualDurationDays:item.durationDays,evidence:'Reviewed workday record confirms active delivery days.'})),estimateEffectivenessReview:{reviewer:'Estimation council',decision:'retain',rationale:'Completed outcomes match the governed estimates and retain source evidence.',reviewedAt:'2027-01-05T01:00:00Z'},estimateDriftHistoricalReports:[estimateDriftHistoricalReport('historical-one','2027-01-01T00:00:00Z'),estimateDriftHistoricalReport('historical-two','2027-01-02T00:00:00Z')],estimateDriftId:'estimate-drift-1',estimateDriftAsOf:'2027-01-06T00:00:00Z',estimateDriftBaselineReportCount:1,estimateDriftRecentReportCount:2,estimateDriftMinimumItemsPerClass:1,estimateDriftMaximumAssessmentGapDays:4,estimateDriftMaximumReportAgeDays:2,estimateDriftMaximumDurationErrorRate:0,estimateDriftMaximumCapacityErrorRate:0,estimateDriftMaximumErrorIncreaseRate:0,estimateDriftMinimumErrorReductionRate:0,estimateDriftMinimumClassCoverageRate:1,estimateDriftReview:{reviewer:'Estimation council',decision:'retain',rationale:'Accuracy remains stable across the baseline and recent windows.',reviewedAt:'2027-01-06T01:00:00Z'}}),env)).json();
  const recalibrationCase=(name,index)=>{const portfolioItemId=`recalibration-item-${name}`;const scheduleReport={schemaVersion:'1.0.0',id:`recalibration-schedule-${name}`,asOf:'2027-01-01T00:00:00Z',status:'approved_schedule',schedule:[{portfolioItemId,title:`Comparable onboarding ${name}`,teamId:'product-team',start:'2027-01-01',finish:'2027-01-10',deadline:'2027-01-10',durationDays:10,capacity:1,evidenceIds:[run.ranking.ranked[0].evidenceIds[0]]}]};return {scheduleReport,deliveryReport:{schemaVersion:'1.0.0',id:`recalibration-delivery-${name}`,asOf:`2027-02-${String(10+index).padStart(2,'0')}T00:00:00Z`,sourceScheduleId:scheduleReport.id,items:[{portfolioItemId,status:'completed',actualStart:'2027-01-01',actualFinish:'2027-01-14',actualCapacityDays:14,deadlineMet:false,evidence:'Reviewed delivery record confirms fourteen elapsed and capacity days.'}]},classifications:[{portfolioItemId,referenceClass:'selected-product-work',basis:'Comparable selected product work with the same delivery shape.'}]};};
  const roadmapRecalibrationInput={
    ...roadmapDeliveryInput,
    estimateAdoptionCalibrationCases:[estimateAdoptionCase('one'),estimateAdoptionCase('two')],estimateAdoptionCalibrationId:'estimate-adoption-calibration-1',estimateAdoptionCalibrationAsOf:'2027-01-02T00:00:00Z',estimateAdoptionCalibrationMinimumReferenceClassSize:2,estimateAdoptionCalibrationPercentileRate:.8,estimateAdoptionCalibrationMaximumEvidenceAgeDays:90,estimateAdoptionCalibrationReview:{reviewer:'Historical calibration council',decision:'adopt',rationale:'The reference class has two fresh comparable outcomes.',reviewedAt:'2027-01-02T01:00:00Z'},
    estimateAdoptionControlId:'estimate-adoption-control-recalibration',estimateAdoptionControlAsOf:'2027-01-03T12:00:00Z',estimateAdoptionMaximumCalibrationAgeDays:30,estimateAdoptionRoundingToleranceDays:0,estimateAdoptionCapacityToleranceRate:0,estimateAdoptionApplications:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,referenceClass:'selected-product-work',baseDurationDays:item.durationDays,baseCapacityDays:item.durationDays*item.capacity,appliedDurationFactor:1,appliedCapacityFactor:1,estimateBasis:'Applied the adopted selected-product-work factors to the reviewed base estimate.',evidence:'Estimate worksheet preserves base values, factor arithmetic, and evidence lineage.'})),estimateAdoptionReview:{reviewer:'Investment committee',decision:'approve',rationale:'Every scheduled estimate reconciles to the prior adopted calibration.',reviewedAt:'2027-01-03T13:00:00Z'},
    estimateEffectivenessId:'estimate-effectiveness-recalibration',estimateEffectivenessAsOf:'2027-02-01T00:00:00Z',estimateEffectivenessMaximumDurationErrorRate:.1,estimateEffectivenessMaximumCapacityErrorRate:.2,estimateEffectivenessMinimumErrorReductionRate:0,estimateEffectivenessOutcomes:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,actualDurationDays:item.durationDays*1.4,evidence:'Reviewed workday record confirms observed active delivery days.'})),estimateEffectivenessReview:{reviewer:'Estimation council',decision:'adjust',rationale:'Duration accuracy deteriorated and needs bounded recalibration.',reviewedAt:'2027-02-01T01:00:00Z'},
    estimateDriftHistoricalReports:[estimateDriftHistoricalReport('recalibration-history-one','2027-01-01T00:00:00Z'),estimateDriftHistoricalReport('recalibration-history-two','2027-01-15T00:00:00Z')],estimateDriftId:'estimate-drift-recalibration',estimateDriftAsOf:'2027-02-02T00:00:00Z',estimateDriftBaselineReportCount:2,estimateDriftRecentReportCount:1,estimateDriftMinimumItemsPerClass:1,estimateDriftMaximumAssessmentGapDays:20,estimateDriftMaximumReportAgeDays:2,estimateDriftMaximumDurationErrorRate:.1,estimateDriftMaximumCapacityErrorRate:.2,estimateDriftMaximumErrorIncreaseRate:.05,estimateDriftMinimumErrorReductionRate:0,estimateDriftMinimumClassCoverageRate:1,estimateDriftReview:{reviewer:'Estimation council',decision:'recalibrate',rationale:'The later duration error exceeds the stable window.',reviewedAt:'2027-02-02T01:00:00Z'},
    recalibrationEvidenceCases:['one','two','three','four','five','six'].map((name,index)=>recalibrationCase(name,index)),recalibrationEvidenceCalibrationId:'recalibration-evidence-1',recalibrationEvidenceCalibrationAsOf:'2027-03-01T00:00:00Z',recalibrationEvidenceMinimumReferenceClassSize:2,recalibrationEvidencePercentileRate:.75,recalibrationEvidenceMaximumAgeDays:90,recalibrationEvidenceReview:{reviewer:'Evidence council',decision:'adopt',rationale:'Six completed comparable cases retain reviewed evidence.',reviewedAt:'2027-03-01T01:00:00Z'},
    recalibrationId:'recalibration-1',recalibrationAsOf:'2027-03-02T00:00:00Z',recalibrationActiveVersion:'estimate-policy-3',recalibrationProposedVersion:'estimate-policy-4',recalibrationValidUntil:'2027-04-01T00:00:00Z',recalibrationMinimumTrainingItemsPerClass:4,recalibrationHoldoutItemsPerClass:2,recalibrationPercentileRate:.75,recalibrationMaximumFactorChangeRate:.5,recalibrationMinimumHoldoutImprovementRate:.05,recalibrationMaximumHoldoutErrorRate:.15,recalibrationRollback:{targetVersion:'estimate-policy-3',owner:'Delivery operations',maximumRecoveryHours:4,evidence:'The previous version remains packaged and deployable.'},recalibrationApprovals:{product:{reviewer:'Product lead',decision:'approve',rationale:'The proposal is limited to the detected class.',reviewedAt:'2027-03-02T01:00:00Z'},engineering:{reviewer:'Engineering lead',decision:'approve',rationale:'Versioning and rollback are executable.',reviewedAt:'2027-03-02T01:05:00Z'},assurance:{reviewer:'Independent assurance',decision:'approve',rationale:'Training and holdout evidence are separate.',reviewedAt:'2027-03-02T01:10:00Z'}},recalibrationReview:{reviewer:'Estimation council chair',decision:'approve',rationale:'The bounded proposal improves untouched evidence and is reversible.',reviewedAt:'2027-03-02T02:00:00Z'}
  };
  const roadmapRecalibration=await(await worker.fetch(req('/api/roadmap-recalibration',roadmapRecalibrationInput),env)).json();
  const rolloutObservation=()=>({referenceClass:'selected-product-work',sampleSize:10,activeDurationErrorRate:.3,candidateDurationErrorRate:.05,activeCapacityErrorRate:.3,candidateCapacityErrorRate:.05,candidateDurationFactor:1.4,candidateCapacityFactor:1.4,incidents:0,evidence:'Reviewed paired planning cohort retains baseline and candidate outcomes.'});
  const roadmapRecalibrationRolloutInput={...roadmapRecalibrationInput,recalibrationRolloutId:'recalibration-rollout-1',recalibrationRolloutAsOf:'2027-03-10T00:00:00Z',recalibrationRolloutMinimumStageDwellHours:24,recalibrationRolloutMinimumSamplesPerClass:30,recalibrationRolloutMaximumExposureRate:.5,recalibrationRolloutMaximumCandidateErrorRate:.15,recalibrationRolloutMinimumImprovementRate:.05,recalibrationRolloutMaximumIncidents:0,recalibrationRolloutDeclaration:{owner:'Delivery operations',declaredAt:'2027-03-02T12:00:00Z',baselineVersion:'estimate-policy-3',targetVersion:'estimate-policy-4',evidence:'Approved rollout record pins the exact baseline and candidate versions.'},recalibrationRolloutStages:[{id:'shadow',mode:'shadow',exposureRate:0,version:'estimate-policy-4',startedAt:'2027-03-03T00:00:00Z',endedAt:'2027-03-04T00:00:00Z',observations:[rolloutObservation()],evidence:'Shadow calculations were reviewed without changing live estimates.'},{id:'canary-10',mode:'active',exposureRate:.1,version:'estimate-policy-4',startedAt:'2027-03-05T00:00:00Z',endedAt:'2027-03-06T00:00:00Z',observations:[rolloutObservation()],evidence:'Ten-percent cohort was reviewed against the concurrent baseline.'},{id:'canary-50',mode:'active',exposureRate:.5,version:'estimate-policy-4',startedAt:'2027-03-07T00:00:00Z',endedAt:'2027-03-08T00:00:00Z',observations:[rolloutObservation()],evidence:'Fifty-percent cohort was reviewed against the concurrent baseline.'}],recalibrationRolloutRollback:{targetVersion:'estimate-policy-3',owner:'Delivery operations',testedAt:'2027-03-09T00:00:00Z',maximumRecoveryHours:4,evidence:'A reviewed exercise restored the prior policy bundle.'},recalibrationRolloutReview:{reviewer:'Estimation council chair',decision:'promote',rationale:'All shadow and staged rollout gates pass.',reviewedAt:'2027-03-10T01:00:00Z'}};
  const roadmapRecalibrationRollout=await(await worker.fetch(req('/api/roadmap-recalibration-rollout',roadmapRecalibrationRolloutInput),env)).json();
  const recoveryRolloutInput={...roadmapRecalibrationRolloutInput,recalibrationRolloutReview:{reviewer:'Estimation council chair',decision:'rollback',rationale:'The staged rollout requires restoration of the approved prior policy.',reviewedAt:'2027-03-10T01:00:00Z'}};
  const recoverySnapshot=(id,observedAt)=>({id,observedAt,version:'estimate-policy-3',referenceClasses:[{referenceClass:'selected-product-work',sampleSize:15,durationErrorRate:.1,capacityErrorRate:.1,incidents:0,evidence:'Reviewed production cohort confirms stable estimates on the restored policy.'}],evidence:'Reviewed recovery snapshot preserves version, accuracy, incident, and sample evidence.'});
  const roadmapRecalibrationRecovery=await(await worker.fetch(req('/api/roadmap-recalibration-recovery',{...recoveryRolloutInput,recalibrationRecoveryId:'recalibration-recovery-1',recalibrationRecoveryAsOf:'2027-03-13T12:00:00Z',recalibrationRecoveryMinimumObservationHours:48,recalibrationRecoveryMaximumSnapshotGapHours:48,recalibrationRecoveryMinimumSamplesPerClass:30,recalibrationRecoveryMaximumDurationErrorRate:.15,recalibrationRecoveryMaximumCapacityErrorRate:.15,recalibrationRecoveryMaximumIncidents:0,recalibrationRecoveryExecution:{rollbackId:'rollback-change-1',authorizedAt:'2027-03-10T01:00:00Z',executedAt:'2027-03-10T03:00:00Z',fromVersion:'estimate-policy-4',toVersion:'estimate-policy-3',owner:'Delivery operations',recoveryHours:2,evidence:'Reviewed change record confirms the authorized rollback restored the prior version.'},recalibrationRecoveryFactorRestorations:[{referenceClass:'selected-product-work',durationFactor:1,capacityFactor:1,evidence:'Versioned policy bundle confirms the exact prior factors were restored.'}],recalibrationRecoverySnapshots:[recoverySnapshot('recovery-24h','2027-03-11T03:00:00Z'),recoverySnapshot('recovery-72h','2027-03-13T03:00:00Z')],recalibrationRecoveryReview:{reviewer:'Estimation council chair',decision:'close',rationale:'Version, factors, observation window, accuracy, and incident gates are verified.',reviewedAt:'2027-03-13T13:00:00Z'}}),env)).json();
  const roadmapRecalibrationReentry=await(await worker.fetch(req('/api/roadmap-recalibration-reentry',{...recoveryRolloutInput,recalibrationRecoveryId:'recalibration-recovery-1',recalibrationRecoveryAsOf:'2027-03-13T12:00:00Z',recalibrationRecoveryMinimumObservationHours:48,recalibrationRecoveryMaximumSnapshotGapHours:48,recalibrationRecoveryMinimumSamplesPerClass:30,recalibrationRecoveryMaximumDurationErrorRate:.15,recalibrationRecoveryMaximumCapacityErrorRate:.15,recalibrationRecoveryMaximumIncidents:0,recalibrationRecoveryExecution:{rollbackId:'rollback-change-1',authorizedAt:'2027-03-10T01:00:00Z',executedAt:'2027-03-10T03:00:00Z',fromVersion:'estimate-policy-4',toVersion:'estimate-policy-3',owner:'Delivery operations',recoveryHours:2,evidence:'Reviewed change record confirms the authorized rollback restored the prior version.'},recalibrationRecoveryFactorRestorations:[{referenceClass:'selected-product-work',durationFactor:1,capacityFactor:1,evidence:'Versioned policy bundle confirms the exact prior factors were restored.'}],recalibrationRecoverySnapshots:[recoverySnapshot('recovery-24h','2027-03-11T03:00:00Z'),recoverySnapshot('recovery-72h','2027-03-13T03:00:00Z')],recalibrationRecoveryReview:{reviewer:'Estimation council chair',decision:'close',rationale:'Version, factors, observation window, accuracy, and incident gates are verified.',reviewedAt:'2027-03-13T13:00:00Z'},recalibrationReentryId:'recalibration-reentry-1',recalibrationReentryAsOf:'2027-03-21T00:00:00Z',recalibrationReentryMaximumPublicationDays:7,recalibrationReentryMinimumCoolingDays:14,recalibrationReentryMaximumInitialExposureRate:.1,recalibrationReentryPublishedAt:'2027-03-18T00:00:00Z',recalibrationReentrySummary:'The candidate degraded cohort accuracy and was rolled back.',recalibrationReentryImpact:'One planning cohort received less accurate estimate factors.',recalibrationReentryTimeline:[{id:'rollback',occurredAt:'2027-03-10T01:00:00Z',event:'Rollback was authorized.',evidence:'Project 49 decision.'},{id:'recovered',occurredAt:'2027-03-13T13:00:00Z',event:'Recovery was verified.',evidence:'Project 50 report.'}],recalibrationReentryContributingConditions:[{id:'condition-1',category:'monitoring',condition:'The candidate threshold missed cohort-specific degradation.',evidence:'Paired cohort trace.'}],recalibrationReentryLessons:[{id:'lesson-1',statement:'Require cohort coverage before exposure.',evidence:'Post-rollback analysis.'}],recalibrationReentryActions:[{id:'prevent-1',type:'prevent',priority:'p1',status:'completed',owner:'Estimation platform',trackingId:'ACT-1',successMeasure:'Coverage blocks incomplete candidates.',dueAt:'2027-03-20T00:00:00Z',evidence:'Passing coverage tests.'},{id:'detect-1',type:'detect',priority:'p2',status:'completed',owner:'Delivery analytics',trackingId:'ACT-2',successMeasure:'Alert detects error regression.',dueAt:'2027-03-20T00:00:00Z',evidence:'Alert exercise record.'}],recalibrationReentryFreezeUntil:'2027-03-27T13:00:00Z',recalibrationReentryPlan:{owner:'Delivery operations',hypothesis:'A new candidate with cohort coverage can improve accuracy safely.',baselineVersion:'estimate-policy-3',candidateVersion:'estimate-policy-5',scope:['selected-product-work'],startsAt:'2027-03-28T13:00:00Z',shadowRequired:true,initialExposureRate:.05,requiredActionIds:['prevent-1','detect-1'],rollback:{targetVersion:'estimate-policy-3',owner:'Delivery operations',maximumRecoveryHours:4,evidence:'Prior version remains packaged and tested.'},monitors:['duration_error','capacity_error','incidents']},recalibrationReentryApprovals:['product','delivery','assurance'].map((role,index)=>({role,reviewer:`Re-entry approver ${index}`,decision:'approved',approvedAt:'2027-03-20T00:00:00Z'})),recalibrationReentryReview:{reviewer:'Re-entry council',decision:'approve_reentry',rationale:'Learning and safety gates are complete.',reviewedAt:'2027-03-21T00:00:00Z'}}),env)).json();
  const roadmapRecalibrationReentryInput=requestBodies.get('/api/roadmap-recalibration-reentry');
  const reentryClassObservation=()=>({referenceClass:'selected-product-work',sampleSize:20,baselineDurationErrorRate:.2,candidateDurationErrorRate:.05,baselineCapacityErrorRate:.2,candidateCapacityErrorRate:.05,incidents:0,evidence:'Reviewed paired outcomes retain recovered-baseline and re-entry-candidate evidence.'});
  const reentryStage=(id,mode,exposureRate,startedAt,endedAt)=>({id,mode,exposureRate,version:'estimate-policy-5',startedAt,endedAt,classObservations:[reentryClassObservation()],recurrenceSignals:[{conditionId:'condition-1',detected:false,evidence:'The cohort-specific degradation did not recur.'}],actionControls:[{actionId:'prevent-1',operational:true,evidence:'The coverage gate remained active.'},{actionId:'detect-1',operational:true,evidence:'The regression alert remained active.'}],evidence:`Reviewed ${id} re-entry evidence.`});
  const roadmapRecalibrationReentryAssurance=await(await worker.fetch(req('/api/roadmap-recalibration-reentry-assurance',{...roadmapRecalibrationReentryInput,recalibrationReentryAssuranceId:'reentry-assurance-1',recalibrationReentryAssuranceAsOf:'2027-03-30T13:00:00Z',recalibrationReentryAssuranceMinimumStageDwellHours:24,recalibrationReentryAssuranceMaximumStageGapHours:0,recalibrationReentryAssuranceMinimumSamplesPerClass:30,recalibrationReentryAssuranceMaximumExposureRate:.05,recalibrationReentryAssuranceMaximumCandidateErrorRate:.15,recalibrationReentryAssuranceMinimumImprovementRate:.05,recalibrationReentryAssuranceMaximumIncidents:0,recalibrationReentryAssuranceDeclaration:{sourceLearningId:'recalibration-reentry-1',owner:'Delivery operations',baselineVersion:'estimate-policy-3',candidateVersion:'estimate-policy-5',scope:['selected-product-work'],declaredAt:'2027-03-27T13:00:00Z',evidence:'Approved re-entry record pins owner, versions, scope, and exposure.'},recalibrationReentryAssuranceStages:[reentryStage('reentry-shadow','shadow',0,'2027-03-28T13:00:00Z','2027-03-29T13:00:00Z'),reentryStage('reentry-active-5','active',.05,'2027-03-29T13:00:00Z','2027-03-30T13:00:00Z')],recalibrationReentryAssuranceRollback:{targetVersion:'estimate-policy-3',owner:'Delivery operations',testedAt:'2027-03-25T00:00:00Z',maximumRecoveryHours:4,evidence:'Reviewed drill restored the recovered baseline.'},recalibrationReentryAssuranceReview:{reviewer:'Independent re-entry assurance lead',decision:'continue',rationale:'The bounded retry remained within every declared control.',reviewedAt:'2027-03-30T14:00:00Z'}}),env)).json();
  const roadmapRecalibrationReentryAssuranceInput=requestBodies.get('/api/roadmap-recalibration-reentry-assurance');
  const promotionCheckpoint=(id,observedAt)=>({id,observedAt,version:'estimate-policy-5',scope:['selected-product-work'],outcomes:[{referenceClass:'selected-product-work',sampleSize:25,baselineDurationErrorRate:.2,candidateDurationErrorRate:.05,baselineCapacityErrorRate:.2,candidateCapacityErrorRate:.05,incidents:0,evidence:'Reviewed paired stabilization outcomes.'}],recurrenceControls:[{conditionId:'condition-1',healthy:true,evidence:'The prior condition did not recur.'}],correctiveControls:[{actionId:'prevent-1',healthy:true,evidence:'Coverage gate passed.'},{actionId:'detect-1',healthy:true,evidence:'Detection exercise passed.'}],evidence:`Reviewed ${id} stabilization record.`});
  const roadmapRecalibrationReentryPromotion=await(await worker.fetch(req('/api/roadmap-recalibration-reentry-promotion',{...roadmapRecalibrationReentryAssuranceInput,recalibrationReentryPromotionId:'reentry-promotion-1',recalibrationReentryPromotionAsOf:'2027-04-03T14:00:00Z',recalibrationReentryPromotionMinimumStabilizationHours:72,recalibrationReentryPromotionMaximumCheckpointGapHours:24,recalibrationReentryPromotionMinimumCheckpoints:3,recalibrationReentryPromotionMinimumSamplesPerClass:60,recalibrationReentryPromotionMaximumCandidateErrorRate:.15,recalibrationReentryPromotionMinimumImprovementRate:.05,recalibrationReentryPromotionMaximumIncidents:0,recalibrationReentryPromotionMaximumRollbackTestAgeDays:14,recalibrationReentryPromotionCheckpoints:[promotionCheckpoint('stability-24h','2027-03-31T14:00:00Z'),promotionCheckpoint('stability-48h','2027-04-01T14:00:00Z'),promotionCheckpoint('stability-72h','2027-04-02T14:00:00Z')],recalibrationReentryPromotionRollback:{targetVersion:'estimate-policy-3',owner:'Delivery operations',testedAt:'2027-03-30T00:00:00Z',maximumRecoveryHours:4,evidence:'Reviewed drill preserved the recovered baseline.'},recalibrationReentryPromotionApprovals:['product','delivery','assurance'].map((role,index)=>({role,reviewer:`Promotion approver ${index}`,decision:'approve',approvedAt:'2027-04-03T13:00:00Z',evidence:`Reviewed ${role} promotion evidence.`})),recalibrationReentryPromotionReview:{reviewer:'Promotion council chair',decision:'promote',rationale:'Sustained evidence and rollback remain within every gate.',reviewedAt:'2027-04-03T15:00:00Z'}}),env)).json();
  const roadmapRecoveryInput={...roadmapScheduleInput,deliveryMonitorId:'delivery-recovery',deliveryAsOf:'2027-01-04T20:00:00Z',deliveryMinimumSnapshots:1,deliveryMaximumSnapshotGapDays:3,deliveryMinimumSchedulePerformanceIndex:.9,deliveryMaximumCapacityOverrunRate:.2,deliverySnapshots:[{id:'delivery-recovery-snapshot',observedAt:'2027-01-04T18:00:00Z',items:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,status:'not_started',completedWorkUnits:0,actualCapacityDays:0,remainingEstimateDays:item.durationDays,actualStart:null,actualFinish:null,evidence:'Reviewed delivery board shows work has not started.',blockers:[]}))}],deliveryReview:{reviewer:'Delivery council',decision:'replan',rationale:'Schedule performance requires a bounded recovery response.',reviewedAt:'2027-01-04T19:00:00Z'},recoveryPlanId:'recovery-1',recoveryAsOf:'2027-01-05T12:00:00Z',recoveryHorizonEnd:'2027-02-28',recoveryCapacityDays:3,recoveryMinimumCoverageRate:1,recoveryCandidates:[{id:'recover-schedule',type:'schedule_repair',title:'Restore delivery sequence',owner:'Delivery lead',targetCheckIds:['schedule-performance'],portfolioItemIds:roadmapSchedule.schedule.map(item=>item.portfolioItemId),effortDays:2,dueAt:'2027-01-12',dependencies:[],changesBaseline:false,reversible:true,rationale:'Reviewed delivery evidence shows the planned work did not start.',exitCriteria:'Schedule performance passes in the next delivery review.',evidence:'Delivery council review dated 2027-01-04.'}],recoveryReview:{reviewer:'Roadmap council',decision:'approve',rationale:'The reversible action covers the failed control within capacity.',reviewedAt:'2027-01-05T13:00:00Z'}};
  const roadmapRecovery=await(await worker.fetch(req('/api/roadmap-recovery',roadmapRecoveryInput),env)).json();
  const roadmapRecoveryVerification=await(await worker.fetch(req('/api/roadmap-recovery-verification',{...roadmapRecoveryInput,verificationDeliveryMonitorId:'delivery-recovered',verificationDeliveryAsOf:'2027-01-20T20:00:00Z',verificationDeliveryMinimumSnapshots:1,verificationDeliveryMaximumSnapshotGapDays:3,verificationDeliveryMinimumSchedulePerformanceIndex:.9,verificationDeliveryMaximumCapacityOverrunRate:.2,verificationDeliverySnapshots:[{id:'delivery-recovered-snapshot',observedAt:'2027-01-20T18:00:00Z',items:roadmapSchedule.schedule.map(item=>({portfolioItemId:item.portfolioItemId,status:'completed',completedWorkUnits:item.durationDays*item.capacity,actualCapacityDays:item.durationDays*item.capacity,remainingEstimateDays:0,actualStart:item.start,actualFinish:item.finish,evidence:'Reviewed delivery board confirms scheduled work completed.',blockers:[]}))}],verificationDeliveryReview:{reviewer:'Delivery council',decision:'continue',rationale:'Follow-up delivery controls pass after recovery execution.',reviewedAt:'2027-01-20T19:00:00Z'},recoveryVerificationId:'recovery-verification-1',recoveryVerificationAsOf:'2027-01-21T12:00:00Z',recoveryVerificationMinimumObservationDays:7,recoveryVerificationMaximumEffortVarianceRate:.25,recoveryVerificationActionOutcomes:[{actionId:'recover-schedule',status:'completed',completedAt:'2027-01-12T18:00:00Z',actualEffortDays:2,executionEvidence:'Reviewed change record confirms the recovery action was implemented.',exitEvidence:'The later Project 41 report confirms schedule performance now passes.'}],recoveryVerificationReview:{reviewer:'Roadmap council',decision:'close',rationale:'Execution, observation, control restoration, and source lineage are verified.',reviewedAt:'2027-01-21T13:00:00Z'}}),env)).json();
  const stress=await(await worker.fetch(req('/api/portfolio-stress',{strategy,capacity:5,scenarios:[{id:'baseline'},{id:'capacity-loss',capacityFactor:.1}]}),env)).json();
  const benefits=await(await worker.fetch(req('/api/benefits-realization',{asOf:'2026-10-01',benefits:[{id:'activation',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,name:'Activation',unit:'percentage_points',direction:'increase',baseline:40,target:50,actual:48,baselineAt:'2026-06-01',targetAt:'2026-12-01',measuredAt:'2026-09-01',owner:'PM',attributionNote:'Reviewed with the experiment; other factors may contribute.'}]}),env)).json();
  const assuranceInput={asOf:'2026-10-01',benefits:[{id:'activation',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,name:'Activation',unit:'percentage_points',direction:'increase',baseline:40,target:50,actual:48,baselineAt:'2026-06-01',targetAt:'2026-12-01',measuredAt:'2026-09-01',owner:'PM',attributionNote:'Reviewed with the experiment; other factors may contribute.'}],reviews:[{id:'pir-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,reviewer:'Product council',reviewedAt:'2026-10-01',decision:'continue',rationale:'Evidence and measurement are complete; continue monitoring.',actions:[]}]};
  const assurance=await(await worker.fetch(req('/api/investment-assurance',assuranceInput),env)).json();
  const assumptions=await(await worker.fetch(req('/api/assumption-risk',{asOf:'2026-10-01',assumptions:[{id:'a-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,statement:'New users understand the onboarding change.',category:'usability',status:'testing',importance:5,uncertainty:.6,owner:'PM',reviewBy:'2026-11-01',validationMethod:'Moderated task study.',linkedEvidenceIds:[run.ranking.ranked[0].evidenceIds[0]],linkedExperimentIds:[run.experiments[0].id]}]}),env)).json();
  const release=await(await worker.fetch(req('/api/release-readiness',{asOf:'2026-10-01',assumptions:[{id:'a-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,statement:'New users understand the onboarding change.',category:'usability',status:'supported',importance:5,uncertainty:.6,owner:'PM',reviewBy:'2026-11-01',validationMethod:'Moderated task study.',linkedEvidenceIds:[run.ranking.ranked[0].evidenceIds[0]],linkedExperimentIds:[run.experiments[0].id]}],releases:[{id:'rel-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,version:'1.2.0',releaseOwner:'PM',onCallOwner:'SRE',strategy:'canary',rolloutSteps:[{trafficPercent:5,minimumMinutes:30},{trafficPercent:100,minimumMinutes:60}],monitors:[{name:'errors',source:'Workers Analytics',direction:'above',threshold:.02,windowMinutes:15}],rollback:{lastKnownGoodVersion:'1.1.0',owner:'SRE',procedure:'Restore version 1.1.0.',maxDecisionMinutes:10,triggerMonitors:['errors']},backwardCompatible:true,communicationPlan:'Notify support.'}]}),env)).json();
  const adoptionInput={asOf:'2026-10-01',assumptions:[{id:'a-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,statement:'New users understand the onboarding change.',category:'usability',status:'supported',importance:5,uncertainty:.6,owner:'PM',reviewBy:'2026-11-01',validationMethod:'Moderated task study.',linkedEvidenceIds:[run.ranking.ranked[0].evidenceIds[0]],linkedExperimentIds:[run.experiments[0].id]}],releases:[{id:'rel-1',portfolioItemId:`${run.id}:${run.ranking.ranked[0].id}`,version:'1.2.0',releaseOwner:'PM',onCallOwner:'SRE',strategy:'canary',rolloutSteps:[{trafficPercent:5,minimumMinutes:30},{trafficPercent:100,minimumMinutes:60}],monitors:[{name:'errors',source:'Workers Analytics',direction:'above',threshold:.02,windowMinutes:15}],rollback:{lastKnownGoodVersion:'1.1.0',owner:'SRE',procedure:'Restore version 1.1.0.',maxDecisionMinutes:10,triggerMonitors:['errors']},backwardCompatible:true,communicationPlan:'Notify support.'}],journeys:[{id:'journey-1',releaseId:'rel-1',stages:['exposed','activated','retained'],minSegmentSize:1,events:[{eventId:'ad-1',userId:'anonymous-1',stage:'exposed',timestamp:'2026-10-02T00:00:00Z',segment:'smb'},{eventId:'ad-2',userId:'anonymous-1',stage:'activated',timestamp:'2026-10-02T00:10:00Z',segment:'smb'},{eventId:'ad-3',userId:'anonymous-1',stage:'retained',timestamp:'2026-10-09T00:00:00Z',segment:'smb'}]}]};
  const adoption=await(await worker.fetch(req('/api/feature-adoption',adoptionInput),env)).json();
  const lifecycleInput={...adoptionInput,plans:[{id:'life-1',journeyId:'journey-1',action:'retire',owner:'Product council',rationale:'Consolidate the workflow only after migration and reviewed customer notice.',decisionAt:'2026-10-10T00:00:00Z',sunsetAt:'2027-02-10T00:00:00Z',minimumNoticeDays:90,replacement:{name:'Unified onboarding',status:'available',migrationGuide:'Move saved configuration to Unified onboarding.'},dependencies:[{id:'support-playbook',owner:'Support',status:'planned',migrationTarget:'Unified onboarding'}],communications:[{audience:'affected customers',channel:'email and in-product',scheduledAt:'2026-11-01T00:00:00Z'}],approvals:['product','engineering','support'].map(role=>({role,reviewer:`${role} lead`,decision:'approved',reviewedAt:'2026-10-11T00:00:00Z'})),exitCriteria:[{name:'No active legacy journeys',measure:'No legacy activation events for 30 days'}]}]};
  const lifecycle=await(await worker.fetch(req('/api/product-lifecycle',lifecycleInput),env)).json();
  const sunset=await(await worker.fetch(req('/api/sunset-migration',{...lifecycleInput,snapshots:[{id:'sunset-1',planId:'life-1',asOf:'2027-02-01T00:00:00Z',minimumZeroDays:14,cohorts:[{id:'smb',label:'SMB customers',owner:'CS',total:1,migrated:1,exempted:0,blocked:0,lastMeasuredAt:'2027-01-31T00:00:00Z'}],dependencies:[{id:'support-playbook',status:'verified',verifiedBy:'Support lead',evidence:'Updated playbook is live.'}],notices:[{audience:'affected customers',channel:'email and in-product',status:'delivered',receipt:'campaign-1'}],exceptions:[],telemetry:{legacyUsageCount:0,replacementUsageCount:1,consecutiveZeroDays:21,lastObservedAt:'2027-01-31T00:00:00Z'},shutdownChecks:[{name:'Archive configuration',passed:true,evidence:'Export verified.'}],approvals:['product','engineering','support'].map(role=>({role,reviewer:`${role} lead`,decision:'approved',reviewedAt:'2027-02-01T00:00:00Z'}))}]}),env)).json();
  const sunsetOutcomeInput={...lifecycleInput,snapshots:[{id:'sunset-1',planId:'life-1',asOf:'2027-02-01T00:00:00Z',minimumZeroDays:14,cohorts:[{id:'smb',label:'SMB customers',owner:'CS',total:1,migrated:1,exempted:0,blocked:0,lastMeasuredAt:'2027-01-31T00:00:00Z'}],dependencies:[{id:'support-playbook',status:'verified',verifiedBy:'Support lead',evidence:'Updated playbook is live.'}],notices:[{audience:'affected customers',channel:'email and in-product',status:'delivered',receipt:'campaign-1'}],exceptions:[],telemetry:{legacyUsageCount:0,replacementUsageCount:1,consecutiveZeroDays:21,lastObservedAt:'2027-01-31T00:00:00Z'},shutdownChecks:[{name:'Archive configuration',passed:true,evidence:'Export verified.'}],approvals:['product','engineering','support'].map(role=>({role,reviewer:`${role} lead`,decision:'approved',reviewedAt:'2027-02-01T00:00:00Z'}))}],reviews:[{id:'outcome-1',snapshotId:'sunset-1',reviewedAt:'2027-03-05T00:00:00Z',observationWindowDays:30,support:{baselineContacts:10,observedContacts:10,maximumIncreaseRate:.1},incidents:{critical:0,customerImpacting:0,maximumCritical:0,maximumCustomerImpacting:0},residualTrafficCount:0,economics:{expectedMonthlySavings:100,observedMonthlySavings:90,minimumRealizationRate:.8,currency:'USD'},rollback:{owner:'Engineering',available:true,testedAt:'2027-02-15T00:00:00Z',procedure:'Restore archived Worker route.',recoveryMinutes:20,maximumRecoveryMinutes:30},correctiveActions:[],decision:{choice:'close',reviewer:'Product council',rationale:'Observation window passed with no declared harm.',reviewedAt:'2027-03-05T00:00:00Z'}}]};
  const sunsetOutcome=await(await worker.fetch(req('/api/sunset-outcomes',sunsetOutcomeInput),env)).json();
  const governanceInput={...sunsetOutcomeInput,packs:[{id:'governance-1',outcomeReviewId:'outcome-1',generatedAt:'2027-03-06T00:00:00Z',owner:'Records owner',purpose:'Preserve the reviewed product retirement decision.',classification:'confidential',retentionDays:365,approvals:['product','engineering','governance'].map((role,index)=>({role,reviewer:`Independent reviewer ${index}`,decision:'approved',reviewedAt:'2027-03-07T00:00:00Z'})),review:{author:'Pack author',certifier:'Governance lead',decision:'certify',rationale:'Authoritative lineage, artifact coverage, and approvals are complete.',reviewedAt:'2027-03-07T00:00:00Z'}}]};
  const governance=await(await worker.fetch(req('/api/governance-pack',governanceInput),env)).json();
  const governanceMonitor=await(await worker.fetch(req('/api/governance-obligations',{...governanceInput,monitors:[{id:'monitor-1',governancePackId:'governance-1',asOf:'2027-03-15T00:00:00Z',observedPackDigest:governance.packs[0].packDigest,reviewIntervalDays:90,certificationValidDays:365,obligations:[{id:'quarterly-control',type:'control_test',owner:'Governance lead',dueAt:'2027-04-01T00:00:00Z',status:'open'}],review:{reviewer:'Independent governance reviewer',decision:'continue',rationale:'Pack digest and time-bound controls remain current.',reviewedAt:'2027-03-15T00:00:00Z'}}]}),env)).json();
  const exceptionMonitor={id:'exception-monitor',governancePackId:'governance-1',asOf:'2027-03-15T00:00:00Z',observedPackDigest:'b'.repeat(64),reviewIntervalDays:90,certificationValidDays:365,obligations:[{id:'remediate-digest',type:'corrective_action',owner:'Governance lead',dueAt:'2027-04-01T00:00:00Z',status:'open'}],review:{reviewer:'Independent governance reviewer',decision:'continue',rationale:'Digest mismatch requires a controlled response.',reviewedAt:'2027-03-15T00:00:00Z'}};
  const exceptionRegister={id:'register-1',monitorId:'exception-monitor',asOf:'2027-03-16T00:00:00Z',exceptions:[{id:'exception-1',targetType:'check',targetId:'digest-continuity',requester:'Product owner',owner:'Governance owner',rationale:'Temporary exception while the authoritative export is restored.',riskRating:'medium',requestedAt:'2027-03-15T00:00:00Z',expiresAt:'2027-04-14T00:00:00Z',compensatingControls:[{id:'daily-review',owner:'Records lead',description:'Review immutable exports every day.',evidence:'Control ticket 12',reviewedAt:'2027-03-16T00:00:00Z'}],remediationObligationId:'remediate-digest',approvals:['product','governance'].map((role,index)=>({role,reviewer:`Exception approver ${index}`,decision:'approved',reviewedAt:'2027-03-16T00:00:00Z'})),review:{reviewer:'Risk chair',decision:'approve',rationale:'Narrow and expiring acceptance with compensating control.',reviewedAt:'2027-03-16T00:00:00Z'}}]};
  const governanceExceptions=await(await worker.fetch(req('/api/governance-exceptions',{...governanceInput,monitors:[exceptionMonitor],registers:[exceptionRegister]}),env)).json();
  const verificationMonitor={id:'verification-monitor',governancePackId:'governance-1',asOf:'2027-04-10T00:00:00Z',observedPackDigest:governance.packs[0].packDigest,reviewIntervalDays:90,certificationValidDays:365,obligations:[{id:'remediate-digest',type:'corrective_action',owner:'Governance lead',dueAt:'2027-04-01T00:00:00Z',status:'completed',completedAt:'2027-03-25T00:00:00Z',evidence:'Reconstructed export digest verified.'}],review:{reviewer:'Follow-up governance reviewer',decision:'continue',rationale:'Digest continuity and remediation are verified.',reviewedAt:'2027-04-10T00:00:00Z'}};
  const exceptionExit=await(await worker.fetch(req('/api/exception-exits',{...governanceInput,baselineMonitors:[exceptionMonitor],registers:[exceptionRegister],verificationMonitors:[verificationMonitor],exitReviews:[{id:'exit-1',registerId:'register-1',exceptionId:'exception-1',verificationMonitorId:'verification-monitor',asOf:'2027-04-10T00:00:00Z',observationWindowDays:14,observedDays:21,residualRisk:'low',effectivenessTests:[{id:'digest-stability',owner:'Records lead',criterion:'Digest remains stable for the observation window.',passed:true,evidence:'21-day digest report.',verifiedAt:'2027-04-09T00:00:00Z'}],approvals:['product','governance'].map((role,index)=>({role,reviewer:`Exit approver ${index}`,decision:'approved',reviewedAt:'2027-04-10T00:00:00Z'})),review:{reviewer:'Independent closer',decision:'close',rationale:'The target and remediation remain effective.',reviewedAt:'2027-04-10T00:00:00Z'}}]}),env)).json();
  const recurrenceMonitor={...verificationMonitor,id:'recurrence-monitor',asOf:'2027-05-01T00:00:00Z',review:{reviewer:'Recurrence reviewer',decision:'continue',rationale:'Control remains stable after verified exit.',reviewedAt:'2027-05-01T00:00:00Z'}};
  const recurrence=await(await worker.fetch(req('/api/control-recurrence',{...governanceInput,baselineMonitors:[exceptionMonitor],registers:[exceptionRegister],verificationMonitors:[verificationMonitor],exitReviews:[exceptionExit.reviews[0]],recurrenceMonitors:[recurrenceMonitor],surveillance:[{id:'surveillance-1',exitReviewId:'exit-1',asOf:'2027-05-02T00:00:00Z',monitorIds:['recurrence-monitor'],minimumSnapshots:1,maximumCadenceDays:30,review:{reviewer:'Governance council',decision:'keep_closed',rationale:'Follow-up control evidence remains stable.',reviewedAt:'2027-05-02T00:00:00Z'}}]}),env)).json();
  const regressedMonitor={...recurrenceMonitor,id:'regressed-monitor',observedPackDigest:'c'.repeat(64),asOf:'2027-05-08T00:00:00Z',review:{reviewer:'Recurrence reviewer',decision:'continue',rationale:'Digest recurrence requires improvement planning.',reviewedAt:'2027-05-08T00:00:00Z'}};
  const improvement=await(await worker.fetch(req('/api/control-improvements',{...governanceInput,baselineMonitors:[exceptionMonitor],registers:[exceptionRegister],verificationMonitors:[verificationMonitor],exitReviews:[exceptionExit.reviews[0]],recurrenceMonitors:[regressedMonitor],surveillance:[{id:'surveillance-improvement',exitReviewId:'exit-1',asOf:'2027-05-09T00:00:00Z',monitorIds:['regressed-monitor'],minimumSnapshots:1,maximumCadenceDays:30,review:{reviewer:'Governance council',decision:'escalate',rationale:'The target recurred and needs preventive improvement.',reviewedAt:'2027-05-09T00:00:00Z'}}],improvementAsOf:'2027-05-10T00:00:00Z',improvementCapacity:3,minimumCoverageRate:1,improvementCandidates:[{id:'improvement-1',title:'Prevent digest recurrence',owner:'Platform lead',effort:3,covers:['surveillance-improvement'],dependencies:[],response:'prevent',dueAt:'2027-06-01T00:00:00Z',successMetric:'Three weekly monitors show stable digest continuity.',verificationWindowDays:30}],improvementReview:{reviewer:'Product governance council',decision:'approve',rationale:'The plan covers the observed recurrence within capacity.',reviewedAt:'2027-05-10T00:00:00Z'}}),env)).json();
  const outcomeStableMonitor={...verificationMonitor,id:'outcome-stable-monitor',asOf:'2027-06-25T00:00:00Z',review:{reviewer:'Outcome reviewer',decision:'continue',rationale:'Digest continuity remains stable after the improvement.',reviewedAt:'2027-06-25T00:00:00Z'}};
  const improvementOutcome=await(await worker.fetch(req('/api/control-improvement-outcomes',{...governanceInput,baselineMonitors:[exceptionMonitor],registers:[exceptionRegister],verificationMonitors:[verificationMonitor],exitReviews:[exceptionExit.reviews[0]],recurrenceMonitors:[regressedMonitor],surveillance:[{id:'surveillance-improvement',exitReviewId:'exit-1',asOf:'2027-05-09T00:00:00Z',monitorIds:['regressed-monitor'],minimumSnapshots:1,maximumCadenceDays:30,review:{reviewer:'Governance council',decision:'escalate',rationale:'The target recurred and needs preventive improvement.',reviewedAt:'2027-05-09T00:00:00Z'}}],improvementAsOf:'2027-05-10T00:00:00Z',improvementCapacity:3,minimumCoverageRate:1,improvementCandidates:[{id:'improvement-1',title:'Prevent digest recurrence',owner:'Platform lead',effort:3,covers:['surveillance-improvement'],dependencies:[],response:'prevent',dueAt:'2027-06-01T00:00:00Z',successMetric:'Three weekly monitors show stable digest continuity.',verificationWindowDays:30}],improvementReview:{reviewer:'Product governance council',decision:'approve',rationale:'The plan covers the observed recurrence within capacity.',reviewedAt:'2027-05-10T00:00:00Z'},outcomeRecurrenceMonitors:[outcomeStableMonitor],outcomeSurveillance:[{id:'surveillance-outcome',exitReviewId:'exit-1',asOf:'2027-06-26T00:00:00Z',monitorIds:['outcome-stable-monitor'],minimumSnapshots:1,maximumCadenceDays:90,review:{reviewer:'Outcome council',decision:'keep_closed',rationale:'The control remains stable after implementation.',reviewedAt:'2027-06-26T00:00:00Z'}}],maximumEffortVarianceRate:.25,improvementOutcomeReviews:[{id:'improvement-outcome-1',improvementActionId:'improvement-1',asOf:'2027-06-26T00:00:00Z',completedAt:'2027-05-20T00:00:00Z',actualEffort:3,minimumFollowups:1,followupSurveillanceIds:['surveillance-outcome'],deliveryEvidence:'Change record 42 deployed.',successEvidence:'Follow-up monitor shows stable digest continuity.',review:{reviewer:'Product governance council',decision:'close',rationale:'Delivery and observation evidence satisfy the approved plan.',reviewedAt:'2027-06-26T00:00:00Z'}}]}),env)).json();
  const calibrationInput={
    ...governanceInput,
    baselineMonitors:[exceptionMonitor],registers:[exceptionRegister],verificationMonitors:[verificationMonitor],
    exitReviews:[exceptionExit.reviews[0]],recurrenceMonitors:[regressedMonitor],
    surveillance:[{id:'surveillance-improvement',exitReviewId:'exit-1',asOf:'2027-05-09T00:00:00Z',monitorIds:['regressed-monitor'],minimumSnapshots:1,maximumCadenceDays:30,review:{reviewer:'Governance council',decision:'escalate',rationale:'The target recurred and needs preventive improvement.',reviewedAt:'2027-05-09T00:00:00Z'}}],
    improvementAsOf:'2027-05-10T00:00:00Z',improvementCapacity:3,minimumCoverageRate:1,
    improvementCandidates:[{id:'improvement-1',title:'Prevent digest recurrence',owner:'Platform lead',effort:3,covers:['surveillance-improvement'],dependencies:[],response:'prevent',dueAt:'2027-06-01T00:00:00Z',successMetric:'Three weekly monitors show stable digest continuity.',verificationWindowDays:30}],
    improvementReview:{reviewer:'Product governance council',decision:'approve',rationale:'The plan covers the observed recurrence within capacity.',reviewedAt:'2027-05-10T00:00:00Z'},
    outcomeRecurrenceMonitors:[outcomeStableMonitor],
    outcomeSurveillance:[{id:'surveillance-outcome',exitReviewId:'exit-1',asOf:'2027-06-26T00:00:00Z',monitorIds:['outcome-stable-monitor'],minimumSnapshots:1,maximumCadenceDays:90,review:{reviewer:'Outcome council',decision:'keep_closed',rationale:'The control remains stable after implementation.',reviewedAt:'2027-06-26T00:00:00Z'}}],
    maximumEffortVarianceRate:.25,
    improvementOutcomeReviews:[{id:'improvement-outcome-1',improvementActionId:'improvement-1',asOf:'2027-06-26T00:00:00Z',completedAt:'2027-05-20T00:00:00Z',actualEffort:3,minimumFollowups:1,followupSurveillanceIds:['surveillance-outcome'],deliveryEvidence:'Change record 42 deployed.',successEvidence:'Follow-up monitor shows stable digest continuity.',review:{reviewer:'Product governance council',decision:'close',rationale:'Delivery and observation evidence satisfy the approved plan.',reviewedAt:'2027-06-26T00:00:00Z'}}],
    calibrationAsOf:'2027-06-27T00:00:00Z',calibrationMinimumSampleSize:1,
    maximumAbsoluteEffortBiasRate:0,calibrationMinimumOnTimeRate:1,
    calibrationMinimumEffectivenessRate:1,calibrationMaximumRecurrenceRate:0,
    calibrationReview:{reviewer:'Portfolio council',decision:'accept_baseline',rationale:'The complete observed portfolio meets the declared calibration thresholds.',reviewedAt:'2027-06-27T00:00:00Z'},
  };
  const improvementCalibration=await(await worker.fetch(req('/api/control-improvement-calibration',calibrationInput),env)).json();
  const policyExperimentInput={
    ...calibrationInput,
    calibrationMinimumSampleSize:2,
    policyExperimentAsOf:'2027-06-28T00:00:00Z',
    policyExperimentCapacity:1,
    policyExperimentMinimumCoverageRate:1,
    policyExperimentCandidates:[{id:'policy-trial-1',title:'Trial a larger calibration sample',owner:'Product operations lead',effort:1,covers:['sample-size'],dependencies:[],policyArea:'measurement',hypothesis:'A longer sampling window produces a decision-ready calibration baseline.',changeDescription:'Collect one additional verified outcome before accepting the planning baseline.',successMetric:'The next calibration includes at least two verified outcomes.',guardrail:'The trial does not delay urgent control response.',primaryMeasure:{name:'Verified outcome sample',unit:'reviews',direction:'increase',baseline:1,target:2},guardrailMeasure:{name:'Urgent response delay',unit:'days',direction:'not_increase',baseline:0,tolerance:0},minimumSampleSize:2,rollbackPlan:'Return to the prior review cadence after the observation window.',reversible:true,startsAt:'2027-07-01T00:00:00Z',reviewAt:'2027-08-01T00:00:00Z',minimumObservationDays:30}],
    policyExperimentReview:{reviewer:'Product operating council',decision:'approve',rationale:'The reversible measurement trial covers the only failed calibration check.',reviewedAt:'2027-06-28T00:00:00Z'},
  };
  const policyExperiments=await(await worker.fetch(req('/api/planning-policy-experiments',policyExperimentInput),env)).json();
  const policyOutcomes=await(await worker.fetch(req('/api/planning-policy-outcomes',{...policyExperimentInput,policyOutcomeAsOf:'2027-08-02T00:00:00Z',policyOutcomeReviews:[{id:'policy-outcome-1',experimentId:'policy-trial-1',completedAt:'2027-08-01T00:00:00Z',sampleSize:2,observedPrimary:2,observedGuardrail:0,deliveryEvidence:'The extended sampling window completed.',analysisEvidence:'Two verified outcome reviews were observed.',review:{reviewer:'Product operating council',decision:'adopt',rationale:'The declared target and guardrail passed after the full observation window.',reviewedAt:'2027-08-02T00:00:00Z'}}]}),env)).json();
  const policyChanges=await(await worker.fetch(req('/api/planning-policy-changes',{...policyExperimentInput,policyOutcomeAsOf:'2027-08-02T00:00:00Z',policyOutcomeReviews:[{id:'policy-outcome-1',experimentId:'policy-trial-1',completedAt:'2027-08-01T00:00:00Z',sampleSize:2,observedPrimary:2,observedGuardrail:0,deliveryEvidence:'The extended sampling window completed.',analysisEvidence:'Two verified outcome reviews were observed.',review:{reviewer:'Product operating council',decision:'adopt',rationale:'The declared target and guardrail passed after the full observation window.',reviewedAt:'2027-08-02T00:00:00Z'}}],policyChangeAsOf:'2027-08-03T00:00:00Z',activePolicies:[{id:'sampling-policy',name:'Outcome sampling policy',version:'1.0.0',activatedAt:'2027-01-01T00:00:00Z',scope:['alpha','beta']}],policyChangeProposals:[{id:'policy-change-1',outcomeReviewId:'policy-outcome-1',policyId:'sampling-policy',owner:'Product operations owner',fromVersion:'1.0.0',toVersion:'1.1.0',scope:['alpha'],description:'Use the verified larger outcome sample for planning calibration.',effectiveAt:'2027-08-10T00:00:00Z',rolloutSteps:[{percent:20,minimumDays:7},{percent:100,minimumDays:14}],monitors:[{name:'decision latency',direction:'above',threshold:7,windowHours:168},{name:'sample completeness',direction:'below',threshold:.95,windowHours:168}],rollback:{owner:'Operations lead',targetVersion:'1.0.0',procedure:'Restore policy version 1.0.0 and notify teams.',maximumDecisionHours:24,triggerMonitors:['decision latency']},evidence:{training:'Training record 12.',communication:'Acknowledgement record 14.'},approvals:['product','operations','governance'].map((role,index)=>({role,reviewer:`Policy reviewer ${index}`,decision:'approved',reviewedAt:'2027-08-03T00:00:00Z'})),review:{reviewer:'Change council',decision:'approve',rationale:'The verified change is scoped, monitored, and reversible.',reviewedAt:'2027-08-03T00:00:00Z'}}]}),env)).json();
  const policyRolloutInput={
    ...policyExperimentInput,
    policyOutcomeAsOf:'2027-08-02T00:00:00Z',
    policyOutcomeReviews:[{id:'policy-outcome-1',experimentId:'policy-trial-1',completedAt:'2027-08-01T00:00:00Z',sampleSize:2,observedPrimary:2,observedGuardrail:0,deliveryEvidence:'The extended sampling window completed.',analysisEvidence:'Two verified outcome reviews were observed.',review:{reviewer:'Product operating council',decision:'adopt',rationale:'The declared target and guardrail passed after the full observation window.',reviewedAt:'2027-08-02T00:00:00Z'}}],
    policyChangeAsOf:'2027-08-03T00:00:00Z',
    activePolicies:[{id:'sampling-policy',name:'Outcome sampling policy',version:'1.0.0',activatedAt:'2027-01-01T00:00:00Z',scope:['alpha','beta']}],
    policyChangeProposals:[{id:'policy-change-1',outcomeReviewId:'policy-outcome-1',policyId:'sampling-policy',owner:'Product operations owner',fromVersion:'1.0.0',toVersion:'1.1.0',scope:['alpha'],description:'Use the verified larger outcome sample for planning calibration.',effectiveAt:'2027-08-10T00:00:00Z',rolloutSteps:[{percent:20,minimumDays:7},{percent:100,minimumDays:14}],monitors:[{name:'decision latency',direction:'above',threshold:7,windowHours:168},{name:'sample completeness',direction:'below',threshold:.95,windowHours:168}],rollback:{owner:'Operations lead',targetVersion:'1.0.0',procedure:'Restore policy version 1.0.0 and notify teams.',maximumDecisionHours:24,triggerMonitors:['decision latency']},evidence:{training:'Training record 12.',communication:'Acknowledgement record 14.'},approvals:['product','operations','governance'].map((role,index)=>({role,reviewer:`Policy reviewer ${index}`,decision:'approved',reviewedAt:'2027-08-03T00:00:00Z'})),review:{reviewer:'Change council',decision:'approve',rationale:'The verified change is scoped, monitored, and reversible.',reviewedAt:'2027-08-03T00:00:00Z'}}],
    policyRolloutAsOf:'2027-08-31T00:00:00Z',
    policyRollouts:[{id:'policy-rollout-1',proposalId:'policy-change-1',activatedAt:'2027-08-10T00:00:00Z',snapshots:[{id:'rollout-snapshot-1',observedAt:'2027-08-10T00:00:00Z',percent:20,version:'1.1.0',monitorValues:[{name:'decision latency',value:5},{name:'sample completeness',value:.97}],evidence:'Pilot cohort and monitor export.'},{id:'rollout-snapshot-2',observedAt:'2027-08-17T00:00:00Z',percent:100,version:'1.1.0',monitorValues:[{name:'decision latency',value:6},{name:'sample completeness',value:.96}],evidence:'Full cohort and monitor export.'}],review:{reviewer:'Change council',decision:'continue',rationale:'Every approved rollout control passed.',reviewedAt:'2027-08-31T00:00:00Z'}}],
  };
  const policyRollouts=await(await worker.fetch(req('/api/planning-policy-rollouts',policyRolloutInput),env)).json();
  const policyEffectivenessInput={
    ...policyRolloutInput,
    policyEffectivenessAsOf:'2027-09-14T00:00:00Z',
    policyMinimumSustainmentDays:28,
    policyMaximumSnapshotGapDays:7,
    policyEffectivenessReviews:[{id:'policy-effectiveness-1',rolloutId:'policy-rollout-1',observations:[
      {id:'effectiveness-snapshot-1',observedAt:'2027-08-24T00:00:00Z',version:'1.1.0',sampleSize:2,observedPrimary:2,observedGuardrail:0,evidence:'Week one planning metrics export.'},
      {id:'effectiveness-snapshot-2',observedAt:'2027-08-31T00:00:00Z',version:'1.1.0',sampleSize:3,observedPrimary:3,observedGuardrail:0,evidence:'Week two planning metrics export.'},
      {id:'effectiveness-snapshot-3',observedAt:'2027-09-07T00:00:00Z',version:'1.1.0',sampleSize:3,observedPrimary:3,observedGuardrail:0,evidence:'Week three planning metrics export.'},
      {id:'effectiveness-snapshot-4',observedAt:'2027-09-14T00:00:00Z',version:'1.1.0',sampleSize:4,observedPrimary:4,observedGuardrail:0,evidence:'Week four planning metrics export.'},
    ],review:{reviewer:'Planning governance council',decision:'retain',rationale:'The predeclared outcome remains sustained without guardrail regression.',reviewedAt:'2027-09-14T00:00:00Z'}}],
  };
  const policyEffectiveness=await(await worker.fetch(req('/api/planning-policy-effectiveness',policyEffectivenessInput),env)).json();
  const policyRecoveryInput={
    ...policyEffectivenessInput,
    policyEffectivenessReviews:policyEffectivenessInput.policyEffectivenessReviews.map(item=>({...item,review:{...item.review,decision:'revert',rationale:'A named human has chosen to restore the approved prior policy.'}})),
    policyRecoveryAsOf:'2027-09-29T00:00:00Z',policyMinimumRecoveryDays:14,policyRecoveryMaximumSnapshotGapDays:7,
    policyRecoveryReviews:[{id:'policy-recovery-1',policyEffectivenessReviewId:'policy-effectiveness-1',initiatedAt:'2027-09-14T06:00:00Z',executionSnapshots:[
      {id:'reversion-stage-1',observedAt:'2027-09-14T06:00:00Z',percentReverted:50,version:'1.0.0',evidence:'Half-scope deployment record.'},
      {id:'reversion-stage-2',observedAt:'2027-09-15T00:00:00Z',percentReverted:100,version:'1.0.0',evidence:'Full-scope deployment record.'},
    ],recoverySnapshots:[
      {id:'recovery-snapshot-1',observedAt:'2027-09-22T00:00:00Z',version:'1.0.0',monitorValues:[{name:'decision latency',value:5},{name:'sample completeness',value:.97}],evidence:'Week one recovery export.'},
      {id:'recovery-snapshot-2',observedAt:'2027-09-29T00:00:00Z',version:'1.0.0',monitorValues:[{name:'decision latency',value:6},{name:'sample completeness',value:.96}],evidence:'Week two recovery export.'},
    ],review:{reviewer:'Planning governance council',decision:'close_reversion',rationale:'The approved version was restored and recovery remained stable.',reviewedAt:'2027-09-29T00:00:00Z'}}],
  };
  const policyRecovery=await(await worker.fetch(req('/api/planning-policy-recovery',policyRecoveryInput),env)).json();
  const policyReentryInput={...policyRecoveryInput,policyReentryAsOf:'2027-10-14T00:00:00Z',policyMaximumReviewDays:7,policyMinimumCoolingDays:14,policyIncidentLearningReviews:[{id:'policy-learning-1',policyRecoveryReviewId:'policy-recovery-1',publishedAt:'2027-10-03T00:00:00Z',summary:'A policy trial degraded the planning guardrail and was reverted.',impact:'The alpha planning cohort experienced delayed decisions.',contributingConditions:[{id:'condition-1',category:'tooling',condition:'Validation allowed an unsafe configuration combination.',evidence:'Configuration and validation trace.'}],lessons:[{id:'lesson-1',statement:'Validate combinations before progressive exposure.',evidence:'Recovery review and control trace.'}],actions:[{id:'action-1',type:'prevent',priority:'p1',status:'completed',owner:'Platform owner',trackingId:'TASK-101',successMeasure:'Unsafe combinations are rejected by deterministic tests.',dueAt:'2027-10-05T00:00:00Z',evidence:'Passing validation suite.'},{id:'action-2',type:'detect',priority:'p2',status:'open',owner:'Analytics owner',trackingId:'TASK-102',successMeasure:'Alert fires before a guardrail breach.',dueAt:'2027-11-01T00:00:00Z'}],freezeUntil:'2027-10-20T00:00:00Z',reentry:{owner:'Planning owner',hypothesis:'A narrower reversible trial can validate the corrected guard.',baselineVersion:'1.0.0',scope:['alpha'],startsAt:'2027-10-20T00:00:00Z',rollbackAcknowledged:true,monitoringAcknowledged:true},approvals:['product','operations','governance'].map((role,index)=>({role,reviewer:`Learning reviewer ${index}`,decision:'approved',approvedAt:'2027-10-06T00:00:00Z'})),review:{reviewer:'Policy learning council',decision:'approve_reentry',rationale:'Critical prevention is complete and the next trial is bounded.',reviewedAt:'2027-10-07T00:00:00Z'}}]};
  const policyReentry=await(await worker.fetch(req('/api/planning-policy-reentry',policyReentryInput),env)).json();
  const policyReentryAssuranceInput={...policyReentryInput,policyReentryAssuranceAsOf:'2027-10-22T00:00:00Z',policyReentryMinimumObservationHours:24,policyReentryMaximumStageGapHours:1,policyReentryMaximumExposurePercent:20,policyReentryMinimumSampleSize:50,policyReentryTrials:[{id:'policy-reentry-assurance-1',incidentLearningReviewId:'policy-learning-1',declaredAt:'2027-10-10T00:00:00Z',owner:'Planning owner',baselineVersion:'1.0.0',scope:['alpha'],startedAt:'2027-10-20T00:00:00Z',endedAt:'2027-10-22T00:00:00Z',monitors:[{id:'recurrence-1',type:'recurrence',sourceId:'condition-1',name:'Unsafe combination recurrence',direction:'above',threshold:0},{id:'guardrail-1',type:'guardrail',sourceId:'planning-latency',name:'Planning latency',direction:'above',threshold:10}],plannedStages:[{id:'reentry-stage-1',exposurePercent:20,minimumHours:24}],executions:[{stageId:'reentry-stage-1',exposurePercent:20,startedAt:'2027-10-20T00:00:00Z',endedAt:'2027-10-22T00:00:00Z',evidence:'Bounded re-entry routing record.',observations:[{id:'reentry-observation-1',observedAt:'2027-10-21T00:00:00Z',sampleSize:100,metrics:[{monitorId:'recurrence-1',value:0,evidence:'No invalid combinations in the validation trace.'},{monitorId:'guardrail-1',value:6,evidence:'Planning latency export.'}],actionControls:[{actionId:'action-1',operational:true,evidence:'Preflight validator log.'}]}]}],review:{reviewer:'Independent operations council',decision:'continue',rationale:'The bounded re-entry followed its declaration with stable controls.',reviewedAt:'2027-10-22T00:00:00Z'}}]};
  const policyReentryAssurance=await(await worker.fetch(req('/api/planning-policy-reentry-assurance',policyReentryAssuranceInput),env)).json();
  assert.equal(reopened.experiments[0].decision.outcome,'iterate');
  assert.deepEqual(ledger.learning[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(ledger.learning[0].outcomeReviews[0].analysis.status,'sustained');
  assert.equal(ledger.learning[0].outcomeReviews[0].decisionId,reopened.experiments[0].decision.id);
  assert.equal(memory.total,1);
  assert.equal(memory.results[0].decisionId,reopened.experiments[0].decision.id);
  assert.deepEqual(memory.results[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(calibration.sampleSize,1);
  assert.equal(calibration.metrics.brierScore,0.04);
  assert.equal(calibration.forecasts[0].decisionId,reopened.experiments[0].decision.id);
  assert.deepEqual(calibration.forecasts[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(integrity.summary.opportunities,1);
  assert.equal(integrity.assessments[0].opportunityId,run.ranking.ranked[0].id);
  assert.deepEqual(integrity.assessments[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(researchPlan.capacity,4);
  assert.equal(researchPlan.objective.optimal,true);
  assert.ok(researchPlan.allActions.every(action=>action.opportunityId===run.ranking.ranked[0].id));
  assert.equal(strategyAudit.strategyId,'test-strategy');
  assert.equal(strategyAudit.summary.alignmentCoverage,1);
  assert.deepEqual(strategyAudit.selectedItems[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(rebalance.optimal,true);
  assert.ok(rebalance.selected.some(item=>item.opportunityId===run.ranking.ranked[0].id));
  assert.deepEqual(rebalance.selected[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapSchedule.status,'approved_schedule');
  assert.equal(roadmapSchedule.id,'roadmap-1');
  assert.deepEqual(roadmapSchedule.schedule[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapDelivery.status,'controlled_delivery');
  assert.equal(roadmapDelivery.sourceScheduleId,'roadmap-1');
  assert.deepEqual(roadmapDelivery.items[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapCalibration.status,'adopted_calibration');
  assert.equal(roadmapCalibration.summary.cases,2);
  assert.equal(roadmapCalibration.referenceClasses[0].recommendedDurationFactor,1);
  assert.deepEqual(roadmapCalibration.observations[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapEstimateAdoption.status,'approved_estimate_basis');
  assert.equal(roadmapEstimateAdoption.sourceScheduleId,'roadmap-1');
  assert.equal(roadmapEstimateAdoption.summary.compliantItems,roadmapSchedule.schedule.length);
  assert.deepEqual(roadmapEstimateAdoption.applications[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapEstimateEffectiveness.status,'verified_effectiveness');
  assert.equal(roadmapEstimateEffectiveness.sourceAdoptionId,'estimate-adoption-control-1');
  assert.equal(roadmapEstimateEffectiveness.summary.accurateItems,roadmapSchedule.schedule.length);
  assert.deepEqual(roadmapEstimateEffectiveness.items[0].customerEvidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapEstimateDrift.status,'stable_calibration');
  assert.equal(roadmapEstimateDrift.summary.reports,3);
  assert.equal(roadmapEstimateDrift.summary.stableClasses,1);
  assert.deepEqual(roadmapEstimateDrift.referenceClasses[0].sourceReportIds,['historical-one','historical-two','estimate-effectiveness-1']);
  assert.equal(roadmapRecalibration.status,'approved_recalibration');
  assert.equal(roadmapRecalibration.sourceDriftId,'estimate-drift-recalibration');
  assert.equal(roadmapRecalibration.proposals[0].candidateDurationFactor,1.4);
  assert.equal(roadmapRecalibration.proposals[0].holdoutSamples,2);
  assert.equal(roadmapRecalibration.activeVersion,'estimate-policy-3');
  assert.equal(roadmapRecalibrationRollout.status,'verified_rollout');
  assert.equal(roadmapRecalibrationRollout.sourceRecalibrationId,'recalibration-1');
  assert.equal(roadmapRecalibrationRollout.summary.totalSamples,30);
  assert.equal(roadmapRecalibrationRollout.review.decision,'promote');
  assert.equal(roadmapRecalibrationRecovery.status,'verified_recovery');
  assert.equal(roadmapRecalibrationRecovery.sourceRolloutId,'recalibration-rollout-1');
  assert.equal(roadmapRecalibrationRecovery.recoveredVersion,'estimate-policy-3');
  assert.equal(roadmapRecalibrationRecovery.summary.totalSamples,30);
  assert.equal(roadmapRecalibrationReentry.status,'ready_for_reentry');
  assert.equal(roadmapRecalibrationReentry.sourceRecoveryId,'recalibration-recovery-1');
  assert.equal(roadmapRecalibrationReentry.reentry.candidateVersion,'estimate-policy-5');
  assert.ok(roadmapRecalibrationReentry.checks.every(item=>item.passed));
  assert.equal(roadmapRecalibrationReentryAssurance.status,'verified_reentry');
  assert.equal(roadmapRecalibrationReentryAssurance.sourceLearningId,'recalibration-reentry-1');
  assert.equal(roadmapRecalibrationReentryAssurance.summary.samples,40);
  assert.ok(roadmapRecalibrationReentryAssurance.checks.every(item=>item.passed));
  assert.equal(roadmapRecalibrationReentryPromotion.status,'ready_for_promotion');
  assert.equal(roadmapRecalibrationReentryPromotion.sourceAssuranceId,'reentry-assurance-1');
  assert.equal(roadmapRecalibrationReentryPromotion.summary.samples,75);
  assert.ok(roadmapRecalibrationReentryPromotion.checks.every(item=>item.passed));
  assert.equal(roadmapRecovery.status,'approved_recovery_plan');
  assert.equal(roadmapRecovery.sourceDeliveryMonitorId,'delivery-recovery');
  assert.deepEqual(roadmapRecovery.selectedActions[0].sourceEvidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(roadmapRecoveryVerification.status,'verified_recovery');
  assert.equal(roadmapRecoveryVerification.sourceRecoveryPlanId,'recovery-1');
  assert.equal(roadmapRecoveryVerification.summary.restoredControls,1);
  assert.deepEqual(roadmapRecoveryVerification.sourceEvidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(stress.summary.scenarios,2);
  assert.equal(stress.summary.weakestScenarioId,'capacity-loss');
  assert.deepEqual(stress.portfolioItems[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(benefits.summary.measured,1);
  assert.deepEqual(benefits.benefits[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(benefits.benefits[0].decisionIds[0],reopened.experiments[0].decision.id);
  assert.equal(assurance.summary.complete,1);
  assert.deepEqual(assurance.reviews[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.deepEqual(assurance.reviews[0].benefitIds,['activation']);
  assert.equal(assumptions.summary.assumptions,1);
  assert.deepEqual(assumptions.assumptions[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.deepEqual(assumptions.assumptions[0].linkedExperimentIds,[run.experiments[0].id]);
  assert.equal(release.summary.releases,1);
  assert.deepEqual(release.releases[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.ok(release.releases[0].failedChecks.includes('ship-decision'));
  assert.equal(adoption.summary.journeys,1);
  assert.equal(adoption.journeys[0].readinessStatus,'blocked');
  assert.deepEqual(adoption.journeys[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.deepEqual(adoption.journeys[0].shipDecisionIds,[]);
  assert.equal(adoption.journeys[0].completionRate,1);
  assert.equal(lifecycle.summary.ready,1);
  assert.equal(lifecycle.plans[0].action,'retire');
  assert.deepEqual(lifecycle.plans[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(lifecycle.plans[0].journeyId,'journey-1');
  assert.equal(sunset.summary.ready,1);
  assert.equal(sunset.snapshots[0].migration.coverage,1);
  assert.deepEqual(sunset.snapshots[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(sunset.snapshots[0].planId,'life-1');
  assert.equal(sunsetOutcome.summary.closed,1);
  assert.equal(sunsetOutcome.reviews[0].snapshotId,'sunset-1');
  assert.deepEqual(sunsetOutcome.reviews[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(governance.summary.certified,1);
  assert.equal(governance.packs[0].artifacts.length,7);
  assert.equal(governance.packs[0].packDigest.length,64);
  assert.deepEqual(governance.packs[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(governanceMonitor.summary.current,1);
  assert.equal(governanceMonitor.monitors[0].governancePackId,'governance-1');
  assert.deepEqual(governanceMonitor.monitors[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(governanceExceptions.summary.active,1);
  assert.equal(governanceExceptions.registers[0].underlyingStatus,'blocked_continue');
  assert.deepEqual(governanceExceptions.registers[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(exceptionExit.summary.verifiedClosed,1);
  assert.equal(exceptionExit.reviews[0].exceptionId,'exception-1');
  assert.deepEqual(exceptionExit.reviews[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(recurrence.summary.stable,1);
  assert.equal(recurrence.surveillance[0].recurrenceCount,0);
  assert.deepEqual(recurrence.surveillance[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(improvement.status,'approved');
  assert.equal(improvement.summary.actionableFindings,1);
  assert.equal(improvement.summary.coverageRate,1);
  assert.deepEqual(improvement.coveredTargets[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(improvementOutcome.summary.verifiedEffective,1);
  assert.equal(improvementOutcome.reviews[0].status,'verified_effective');
  assert.deepEqual(improvementOutcome.reviews[0].evidenceIds,run.ranking.ranked[0].evidenceIds);
  assert.equal(improvementCalibration.status,'calibrated');
  assert.equal(improvementCalibration.portfolio.sampleSize,1);
  assert.equal(improvementCalibration.planningSignals.descriptiveEffortMultiplier,1);
  assert.deepEqual(improvementCalibration.sourceOutcomeReviewIds,['improvement-outcome-1']);
  assert.equal(policyExperiments.status,'approved');
  assert.equal(policyExperiments.summary.calibrationGaps,1);
  assert.deepEqual(policyExperiments.sourceOutcomeReviewIds,['improvement-outcome-1']);
  assert.equal(policyOutcomes.status,'verified_adopt');
  assert.deepEqual(policyOutcomes.sourceOutcomeReviewIds,['improvement-outcome-1']);
  assert.deepEqual(policyOutcomes.sourcePolicyExperimentIds,['policy-trial-1']);
  assert.equal(policyChanges.status,'ready_to_activate');
  assert.deepEqual(policyChanges.sourceOutcomeReviewIds,['policy-outcome-1']);
  assert.equal(policyChanges.proposals[0].toVersion,'1.1.0');
  assert.equal(policyRollouts.status,'verified_rollout');
  assert.deepEqual(policyRollouts.sourcePolicyChangeIds,['policy-change-1']);
  assert.deepEqual(policyRollouts.sourceOutcomeReviewIds,['policy-outcome-1']);
  assert.equal(policyEffectiveness.status,'sustained_effectiveness');
  assert.deepEqual(policyEffectiveness.sourcePolicyRolloutIds,['policy-rollout-1']);
  assert.deepEqual(policyEffectiveness.sourcePolicyExperimentIds,['policy-trial-1']);
  assert.equal(policyEffectiveness.policyReviews[0].drift.targetRegressionDetected,false);
  assert.equal(policyRecovery.status,'verified_recovery');
  assert.deepEqual(policyRecovery.sourcePolicyEffectivenessReviewIds,['policy-effectiveness-1']);
  assert.deepEqual(policyRecovery.sourcePolicyExperimentIds,['policy-trial-1']);
  assert.equal(policyRecovery.policyRecoveryReviews[0].recoveredVersion,'1.0.0');
  assert.equal(policyReentry.status,'ready_for_reentry');
  assert.deepEqual(policyReentry.sourcePolicyRecoveryReviewIds,['policy-recovery-1']);
  assert.deepEqual(policyReentry.sourcePolicyExperimentIds,['policy-trial-1']);
  assert.equal(policyReentryAssurance.status,'verified_reentry');
  assert.deepEqual(policyReentryAssurance.sourceIncidentLearningReviewIds,['policy-learning-1']);
  assert.deepEqual(policyReentryAssurance.sourcePolicyRecoveryReviewIds,['policy-recovery-1']);
  assert.ok(policyReentryAssurance.reentryAssuranceTrials[0].checks.every(item=>item.passed));
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM product_run_history').get().n,7);
});

test('concurrent writers cannot overwrite a newer workflow version',async t=>{
  const store=new RunStore(database(t));const run=await store.create(await discover(fixture(),now));
  const results=await Promise.allSettled([store.save({...run,title:'First'},1),store.save({...run,title:'Second'},1)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await store.get(run.id)).version,2);
});

test('collector D1 export timestamp maps to the common evidence contract',async()=>{
  const data=fixture();data.records[0].created_at=data.records[0].timestamp;data.records[0].metadata='{"imported":true}';delete data.records[0].timestamp;
  const run=await discover(data,now);assert.equal(run.evidence[0].createdAt,data.records[0].created_at);
});

test('lightweight integrated ranking does not claim simulated uncertainty',async()=>{
  const run=await ranked();assert.equal(run.ranking.ranked[0].uncertaintyBand,null);
  assert.ok(!run.ranking.method.includes('monte-carlo'));
});

test('prototype-like words remain finite topic features',async()=>{
  const input=fixture();input.records[0].text='Please fix constructor and __proto__ behavior in the app';
  const run=await discover(input,now);
  assert.ok(run.topics.assignments.every(a=>Number.isFinite(a.similarity)));
  assert.ok(run.topics.topics.every(t=>t.keywords.every(k=>Number.isFinite(k.score))));
});

test('workspace UI exposes monitoring and searchable product memory',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(html,/8 Monitor/);
  assert.match(html,/9 Remember/);
  assert.match(html,/10 Calibrate/);
  assert.match(html,/11 Verify/);
  assert.match(html,/12 Plan research/);
  assert.match(html,/13 Align strategy/);
  assert.match(html,/14 Rebalance/);
  assert.match(html,/15 Stress test/);
  assert.match(html,/16 Realize benefits/);
  assert.match(html,/17 Assure investment/);
  assert.match(html,/18 Test assumptions/);
  assert.match(html,/19 Release safely/);
  assert.match(html,/20 Measure adoption/);
  assert.match(html,/21 Govern lifecycle/);
  assert.match(html,/22 Verify migration/);
  assert.match(html,/23 Verify outcomes/);
  assert.match(html,/24 Package provenance/);
  assert.match(html,/25 Monitor governance/);
  assert.match(html,/26 Govern exceptions/);
  assert.match(html,/27 Verify exception exits/);
  assert.match(html,/28 Monitor recurrence/);
  assert.match(html,/29 Plan improvements/);
  assert.match(html,/30 Verify improvements/);
  assert.match(html,/31 Calibrate improvements/);
  assert.match(html,/32 Test planning policy/);
  assert.match(html,/33 Verify planning policy/);
  assert.match(html,/34 Control policy change/);
  assert.match(html,/35 Assure policy rollout/);
  assert.match(html,/36 Monitor policy effectiveness/);
  assert.match(html,/37 Verify policy recovery/);
  assert.match(html,/38 Govern policy re-entry/);
  assert.match(html,/39 Assure policy re-entry/);
  assert.match(html,/40 Schedule roadmap/);
  assert.match(html,/41 Monitor delivery/);
  assert.match(html,/42 Plan recovery/);
  assert.match(html,/43 Verify recovery/);
  assert.match(html,/44 Calibrate estimates/);
  assert.match(html,/45 Control estimates/);
  assert.match(html,/48: Control recalibration/);
  assert.match(html,/49: Assure recalibration rollout/);
  assert.match(html,/50: Verify recalibration recovery/);
  assert.match(html,/51: Govern recalibration re-entry/);
  assert.match(html,/52: Assure recalibration re-entry/);
  assert.match(html,/53: Govern re-entry promotion/);
  assert.match(html,/all fifty-three modules/);
  assert.match(app,/\/api\/calibration/);
  assert.match(app,/\/api\/evidence-integrity/);
  assert.match(app,/\/api\/research-plan/);
  assert.match(app,/\/api\/strategy-audit/);
  assert.match(app,/\/api\/portfolio-rebalance/);
  assert.match(app,/\/api\/roadmap-schedule/);
  assert.match(app,/\/api\/roadmap-delivery/);
  assert.match(app,/\/api\/roadmap-recovery/);
  assert.match(app,/\/api\/roadmap-recovery-verification/);
  assert.match(app,/\/api\/roadmap-estimate-calibration/);
  assert.match(app,/\/api\/roadmap-estimate-adoption/);
  assert.match(app,/\/api\/roadmap-estimate-effectiveness/);
  assert.match(app,/\/api\/roadmap-estimate-drift/);
  assert.match(app,/\/api\/roadmap-recalibration/);
  assert.match(app,/\/api\/roadmap-recalibration-rollout/);
  assert.match(app,/\/api\/roadmap-recalibration-recovery/);
  assert.match(app,/\/api\/roadmap-recalibration-reentry/);
  assert.match(app,/\/api\/roadmap-recalibration-reentry-assurance/);
  assert.match(app,/\/api\/roadmap-recalibration-reentry-promotion/);
  assert.match(app,/\/api\/portfolio-stress/);
  assert.match(app,/\/api\/benefits-realization/);
  assert.match(app,/\/api\/investment-assurance/);
  assert.match(app,/\/api\/assumption-risk/);
  assert.match(app,/\/api\/release-readiness/);
  assert.match(app,/\/api\/feature-adoption/);
  assert.match(app,/\/api\/product-lifecycle/);
  assert.match(app,/\/api\/sunset-migration/);
  assert.match(app,/\/api\/sunset-outcomes/);
  assert.match(app,/\/api\/governance-pack/);
  assert.match(app,/\/api\/governance-obligations/);
  assert.match(app,/\/api\/governance-exceptions/);
  assert.match(app,/\/api\/exception-exits/);
  assert.match(app,/\/api\/control-recurrence/);
  assert.match(app,/\/api\/control-improvements/);
  assert.match(app,/\/api\/control-improvement-outcomes/);
  assert.match(app,/\/api\/control-improvement-calibration/);
  assert.match(app,/\/api\/planning-policy-experiments/);
  assert.match(app,/\/api\/planning-policy-outcomes/);
  assert.match(app,/\/api\/planning-policy-changes/);
  assert.match(app,/\/api\/planning-policy-rollouts/);
  assert.match(app,/\/api\/planning-policy-effectiveness/);
  assert.match(app,/\/api\/planning-policy-recovery/);
  assert.match(app,/\/api\/planning-policy-reentry/);
  assert.match(app,/\/api\/planning-policy-reentry-assurance/);
  assert.match(app,/learning\/\$\{e\.id\}\/monitor/);
  assert.match(app,/Outcome reviews/);
  assert.match(app,/\/api\/memory/);
});
