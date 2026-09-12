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
const req=(path,body,token='secret')=>new Request(`https://prodmind.test${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
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
  assert.match(html,/all fourteen modules/);
  assert.match(app,/\/api\/calibration/);
  assert.match(app,/\/api\/evidence-integrity/);
  assert.match(app,/\/api\/research-plan/);
  assert.match(app,/\/api\/strategy-audit/);
  assert.match(app,/\/api\/portfolio-rebalance/);
  assert.match(app,/learning\/\$\{e\.id\}\/monitor/);
  assert.match(app,/Outcome reviews/);
  assert.match(app,/\/api\/memory/);
});
