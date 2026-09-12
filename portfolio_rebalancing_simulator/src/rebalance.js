const round=value=>Number(value.toFixed(4));
const text=(value,name)=>{if(typeof value!=='string'||!value.trim()||value.length>120)throw new Error(`${name} must contain 1–120 characters`);return value.trim();};

function model(runs,strategy){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');
  if(!strategy||!Array.isArray(strategy.objectives)||!strategy.objectives.length||strategy.objectives.length>20)throw new Error('Provide 1–20 objectives');
  const objectiveIds=new Set();const objectives=strategy.objectives.map((o,index)=>{const id=text(o.id,`Objective ${index+1} id`);if(objectiveIds.has(id))throw new Error('Objective IDs must be unique');objectiveIds.add(id);for(const key of ['targetShare','minShare','maxShare'])if(!Number.isFinite(o[key])||o[key]<0||o[key]>1)throw new Error(`${id} ${key} must be 0–1`);if(o.minShare>o.targetShare||o.targetShare>o.maxShare)throw new Error(`${id} range must contain targetShare`);return {...o,id};});
  if(Math.abs(objectives.reduce((s,o)=>s+o.targetShare,0)-1)>.0001)throw new Error('Objective targetShare values must sum to 1');
  const candidates=[];const current=new Set();
  for(const run of runs){if(!run?.ranking)continue;const selected=new Set(run.ranking.portfolio?.selected??[]);for(const item of run.ranking.ranked??[]){if(!Number.isFinite(item.effort)||item.effort<=0||!Number.isFinite(item.score))throw new Error('Candidates require positive effort and a finite score');const portfolioItemId=`${run.id}:${item.id}`;const candidate={portfolioItemId,runId:run.id,runTitle:run.title,opportunityId:item.id,title:item.title,effort:item.effort,score:item.score,dependencies:[...(item.dependencies??[])].map(id=>`${run.id}:${id}`),objectiveId:null,evidenceIds:[...(item.evidenceIds??[])]};candidates.push(candidate);if(selected.has(item.id))current.add(portfolioItemId);}}
  const exact=new Map(),legacy=new Map();for(const item of strategy.mappings??[]){if(!objectiveIds.has(item.objectiveId))throw new Error(`Unknown objective: ${item.objectiveId}`);const opportunityId=text(item.opportunityId,'mapping opportunityId');const key=item.portfolioItemId?text(item.portfolioItemId,'mapping portfolioItemId'):item.runId?`${text(item.runId,'mapping runId')}:${opportunityId}`:opportunityId;const target=item.portfolioItemId||item.runId?exact:legacy;if(target.has(key))throw new Error(`Duplicate mapping: ${key}`);target.set(key,item.objectiveId);}
  for(const [opportunityId,objectiveId] of legacy){const matches=candidates.filter(item=>item.opportunityId===opportunityId);if(matches.length>1)throw new Error(`Mapping ${opportunityId} is ambiguous across runs; provide runId or portfolioItemId`);if(matches.length===1)exact.set(matches[0].portfolioItemId,objectiveId);}
  for(const candidate of candidates)candidate.objectiveId=exact.get(candidate.portfolioItemId)??null;
  if(candidates.length>18)throw new Error('At most 18 ranked opportunities can be rebalanced exactly');return {objectives,candidates,current};
}

function allocation(selected,objectives){const effort=selected.reduce((s,i)=>s+i.effort,0);return objectives.map(o=>{const assigned=selected.filter(i=>i.objectiveId===o.id);const objectiveEffort=assigned.reduce((s,i)=>s+i.effort,0);const share=effort?objectiveEffort/effort:0;const violation=share<o.minShare?o.minShare-share:share>o.maxShare?share-o.maxShare:0;return {...o,effort:round(objectiveEffort),actualShare:round(share),violation:round(violation),portfolioItemIds:assigned.map(i=>i.portfolioItemId),opportunityIds:assigned.map(i=>i.opportunityId)};});}

export function rebalancePortfolio(runs,strategy,options={}){
  const {objectives,candidates,current}=model(runs,strategy);const capacity=options.capacity??candidates.filter(i=>current.has(i.portfolioItemId)).reduce((s,i)=>s+i.effort,0);if(!Number.isFinite(capacity)||capacity<0||capacity>100000)throw new Error('capacity must be between 0 and 100000');
  const locked=new Set(options.lockedPortfolioItemIds??[]);for(const opportunityId of options.lockedOpportunityIds??[]){const matches=candidates.filter(item=>item.opportunityId===opportunityId&&current.has(item.portfolioItemId));if(matches.length>1)throw new Error(`Locked opportunity ${opportunityId} is ambiguous across runs; use lockedPortfolioItemIds`);if(matches.length===1)locked.add(matches[0].portfolioItemId);else locked.add(opportunityId);}
  for(const id of locked)if(!current.has(id))throw new Error(`Locked portfolio item is not currently selected: ${id}`);const index=new Map(candidates.map((c,i)=>[c.portfolioItemId,i]));for(const item of candidates)for(const dep of item.dependencies)if(!index.has(dep))throw new Error(`Missing dependency candidate: ${dep}`);
  let best=null;const combinations=2**candidates.length;
  for(let mask=0;mask<combinations;mask++){
    const selected=candidates.filter((_,i)=>mask&(2**i));const ids=new Set(selected.map(i=>i.portfolioItemId));const effort=selected.reduce((s,i)=>s+i.effort,0);if(effort>capacity||[...locked].some(id=>!ids.has(id))||selected.some(item=>!item.objectiveId||item.dependencies.some(dep=>!ids.has(dep))))continue;
    const allocations=allocation(selected,objectives);const violation=round(allocations.reduce((s,a)=>s+a.violation,0));const changes=[...new Set([...current,...ids])].filter(id=>current.has(id)!==ids.has(id)).length;const score=selected.reduce((s,i)=>s+i.score,0);const candidate={mask,selected,effort,allocations,violation,changes,score};
    const better=!best||violation<best.violation||
      (violation===best.violation&&changes<best.changes)||
      (violation===best.violation&&changes===best.changes&&score>best.score)||
      (violation===best.violation&&changes===best.changes&&score===best.score&&effort>best.effort)||
      (violation===best.violation&&changes===best.changes&&score===best.score&&effort===best.effort&&mask<best.mask);
    if(better)best=candidate;
  }
  if(!best)return {schemaVersion:'1.1.0',status:'infeasible',reason:'No portfolio satisfies capacity, locks, mappings, and dependencies.',capacity,combinationsEvaluated:combinations,optimal:true};
  const selectedIds=new Set(best.selected.map(i=>i.portfolioItemId));return {schemaVersion:'1.1.0',status:best.violation===0?'aligned':'closest_feasible',capacity,usedCapacity:round(best.effort),remainingCapacity:round(capacity-best.effort),rangeViolation:best.violation,changeCount:best.changes,totalScore:round(best.score),added:best.selected.filter(i=>!current.has(i.portfolioItemId)),removed:candidates.filter(i=>current.has(i.portfolioItemId)&&!selectedIds.has(i.portfolioItemId)),retained:best.selected.filter(i=>current.has(i.portfolioItemId)),selected:best.selected,allocation:best.allocations,optimal:true,combinationsEvaluated:combinations,method:'exact bounded minimum-disruption search; scenario requires human approval and does not mutate saved rankings'};
}
