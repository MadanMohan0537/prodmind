const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const required=(value,name)=>{if(typeof value!=='string'||!value.trim())throw new Error(name+' is required');return value.trim()};
const number=(value,name)=>{if(!Number.isFinite(value))throw new Error(name+' must be finite');return value};
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const stdev=values=>{const m=mean(values);return Math.sqrt(values.reduce((n,x)=>n+(x-m)**2,0)/Math.max(1,values.length-1))};
const round=value=>Number(value.toFixed(4));
function observations(values,name){
  if(!Array.isArray(values)||values.length<3||values.length>365)throw new Error(name+' requires 3–365 observations');
  const seen=new Set();let previous=-Infinity;
  return values.map((row,index)=>{
    if(!row||typeof row!=='object')throw new Error(name+' observation '+(index+1)+' must be an object');
    const period=required(row.period,name+' period');
    if(!iso.test(period)||new Date(period).toISOString()!==period)throw new Error(name+' periods require exact UTC milliseconds');
    const time=Date.parse(period);if(time<=previous||seen.has(period))throw new Error(name+' periods must be unique and increasing');
    if(time>Date.now()+300000)throw new Error(name+' cannot contain future observations');
    seen.add(period);previous=time;return {period,value:number(row.value,name+' value')};
  });
}
export function validatePlan(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Input must be an object');
  const direction=input.direction;if(!['increase','decrease'].includes(direction))throw new Error('direction must be increase or decrease');
  const baseline=observations(input.baseline,'baseline'),observed=observations(input.observed,'observed');
  if(Date.parse(observed[0].period)<=Date.parse(baseline.at(-1).period))throw new Error('observed periods must follow baseline');
  const targetChange=number(input.targetChange,'targetChange');if(targetChange<0||targetChange>10)throw new Error('targetChange must be 0–10 as a decimal');
  const guardrails=(input.guardrails??[]).map((g,index)=>{
    const kind=g.kind;if(!['minimum','maximum'].includes(kind))throw new Error('guardrail kind must be minimum or maximum');
    return {name:required(g.name,'guardrail name'),kind,threshold:number(g.threshold,'guardrail threshold'),current:number(g.current,'guardrail current')};
  });
  if(guardrails.length>10||new Set(guardrails.map(g=>g.name)).size!==guardrails.length)throw new Error('Use at most 10 uniquely named guardrails');
  return {schemaVersion:'1.0.0',monitorId:input.monitorId?required(input.monitorId,'monitorId'):crypto.randomUUID(),title:required(input.title,'title'),opportunityId:required(input.opportunityId,'opportunityId'),experimentId:required(input.experimentId,'experimentId'),decisionId:required(input.decisionId,'decisionId'),metric:{name:required(input.metric?.name,'metric name'),unit:required(input.metric?.unit,'metric unit')},direction,targetChange,baseline,observed,guardrails,owner:required(input.owner,'owner'),reviewCadence:required(input.reviewCadence,'reviewCadence')};
}
export function analyzeOutcome(input){
  const plan=validatePlan(input),base=plan.baseline.map(x=>x.value),actual=plan.observed.map(x=>x.value);
  const baselineMean=mean(base),sigma=stdev(base),latest=actual.at(-1),change=baselineMean===0?null:(latest-baselineMean)/Math.abs(baselineMean);
  const beneficial=plan.direction==='increase'?(change??-Infinity):(change==null?-Infinity:-change);
  let ewma=baselineMean;const lambda=.2;const points=plan.observed.map(row=>{ewma=lambda*row.value+(1-lambda)*ewma;const z=sigma===0?(row.value===baselineMean?0:(row.value>baselineMean?Infinity:-Infinity)):(row.value-baselineMean)/sigma;return {...row,ewma:round(ewma),zScore:Number.isFinite(z)?round(z):z}});
  const targetMet=beneficial>=plan.targetChange;
  const recent=actual.slice(-3),recentChanges=recent.map(x=>baselineMean===0?null:(x-baselineMean)/Math.abs(baselineMean));
  const sustained=recent.length===3&&recentChanges.every(x=>x!==null&&(plan.direction==='increase'?x>=plan.targetChange:-x>=plan.targetChange));
  const midpoint=Math.max(1,Math.floor(actual.length/2)),early=mean(actual.slice(0,midpoint)),late=mean(actual.slice(midpoint));
  const earlyBenefit=baselineMean===0?null:(plan.direction==='increase'?early-baselineMean:baselineMean-early)/Math.abs(baselineMean);
  const lateBenefit=baselineMean===0?null:(plan.direction==='increase'?late-baselineMean:baselineMean-late)/Math.abs(baselineMean);
  const reversal=actual.length>=6&&earlyBenefit!==null&&earlyBenefit>=plan.targetChange&&lateBenefit<plan.targetChange;
  const breaches=plan.guardrails.filter(g=>g.kind==='minimum'?g.current<g.threshold:g.current>g.threshold).map(g=>({...g,margin:round(g.current-g.threshold)}));
  const signals=[];if(plan.baseline.length<25)signals.push({code:'limited_baseline',severity:'review',message:'Fewer than 25 baseline observations; estimated control behavior may be unstable.'});
  for(const point of points)if(Math.abs(point.zScore)>3)signals.push({code:'control_limit_signal',severity:'review',period:point.period,message:'Observation exceeds the descriptive three-sigma baseline band.'});
  if(reversal)signals.push({code:'effect_reversal',severity:'high',message:'Early improvement did not persist in the later observation window.'});
  if(breaches.length)signals.push({code:'guardrail_breach',severity:'high',message:breaches.length+' guardrail threshold(s) are breached.'});
  const status=breaches.length||reversal?'at_risk':sustained?'sustained':targetMet?'emerging':'below_target';
  const action=status==='sustained'?'Continue monitoring at the declared cadence.':status==='at_risk'?'Review the rollout and underlying data before expanding exposure.':'Collect more post-decision observations and investigate segment-level evidence.';
  return {...plan,analysis:{baselineMean:round(baselineMean),baselineStdev:round(sigma),lowerControl:round(baselineMean-3*sigma),upperControl:round(baselineMean+3*sigma),latest,relativeChange:change==null?null:round(change),targetMet,sustained,reversal,status,ewmaLambda:lambda,points,guardrailBreaches:breaches,signals,action,interpretation:'Monitoring signals identify change patterns; they do not establish that the product decision caused them.'}};
}
export function fromLearningDecision(decision,details){
  if(!decision||!Array.isArray(decision.evidenceIds)||!decision.opportunityId)throw new Error('Expected a Project 7 learning-ledger decision');
  return {...details,opportunityId:decision.opportunityId,experimentId:decision.experimentId,decisionId:decision.decisionId??decision.auditId,evidenceIds:[...decision.evidenceIds]};
}
