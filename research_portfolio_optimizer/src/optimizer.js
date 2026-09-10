const severityWeight={blocker:8,high:5,medium:3,review:1};
const round=value=>Number(value.toFixed(4));
const actionTemplates={
  broken_lineage:{title:'Repair evidence lineage',effort:1,method:'Audit source records and restore or explicitly retire missing identifiers.'},
  stale_evidence:{title:'Refresh customer evidence',effort:3,method:'Run a focused round of current interviews or intercept research.'},
  small_sample:{title:'Expand the evidence sample',effort:3,method:'Collect additional observations using the same documented question and eligibility rules.'},
  source_gap:{title:'Add an independent evidence source',effort:2,method:'Validate the need through a different customer channel.'},
  source_concentration:{title:'Reduce source concentration',effort:2,method:'Sample an underrepresented channel before reusing the opportunity.'},
  segment_gap:{title:'Research missing customer segments',effort:3,method:'Recruit and analyze at least one relevant underrepresented segment.'},
  unknown_segments:{title:'Resolve segment metadata',effort:1,method:'Correct source metadata without guessing customer attributes.'},
  polarized_signal:{title:'Run a segment contrast study',effort:2,method:'Compare positive and negative evidence by segment, source, and context.'},
};
const targetId=(opportunityId,code)=>`${opportunityId}:${code}`;

export function deriveResearchBacklog(integrity){
  if(!integrity||!Array.isArray(integrity.assessments))throw new Error('A Project 11 integrity report is required');
  const actions=[];
  for(const item of integrity.assessments){
    for(const finding of item.findings){const template=actionTemplates[finding.code];if(!template)continue;actions.push({id:`research-${item.opportunityId}-${finding.code}`,title:`${template.title}: ${item.opportunityTitle}`.slice(0,200),opportunityId:item.opportunityId,effort:template.effort,covers:[targetId(item.opportunityId,finding.code)],method:template.method,sourceFinding:{code:finding.code,severity:finding.severity,message:finding.message}});}
  }
  actions.sort((a,b)=>a.id.localeCompare(b.id));return actions;
}

function normalizeTargets(integrity){
  return integrity.assessments.flatMap(item=>item.findings.map(finding=>({id:targetId(item.opportunityId,finding.code),opportunityId:item.opportunityId,opportunityTitle:item.opportunityTitle,code:finding.code,severity:finding.severity,weight:severityWeight[finding.severity]??1,message:finding.message})));
}

export function optimizeResearchPortfolio({integrity,actions,capacity}){
  if(!integrity||!Array.isArray(integrity.assessments))throw new Error('A Project 11 integrity report is required');
  if(!Array.isArray(actions)||actions.length>16)throw new Error('Provide at most 16 research actions');
  if(!Number.isFinite(capacity)||capacity<0||capacity>1000)throw new Error('capacity must be between 0 and 1000');
  const targets=normalizeTargets(integrity);const targetMap=new Map(targets.map(t=>[t.id,t]));const seen=new Set();
  const normalized=actions.map((action,index)=>{
    if(!action||typeof action.id!=='string'||!action.id.trim()||seen.has(action.id))throw new Error(`Action ${index+1} needs a unique ID`);seen.add(action.id);
    if(!Number.isFinite(action.effort)||action.effort<=0||action.effort>1000)throw new Error(`Action ${action.id} effort must be positive`);
    if(!Array.isArray(action.covers)||!action.covers.length||action.covers.some(id=>!targetMap.has(id)))throw new Error(`Action ${action.id} must cover known finding IDs`);
    const dependencies=[...new Set(action.dependencies??[])];return {...action,id:action.id.trim(),covers:[...new Set(action.covers)],dependencies};
  });
  const byId=new Map(normalized.map(a=>[a.id,a]));for(const action of normalized)for(const dep of action.dependencies)if(!byId.has(dep)||dep===action.id)throw new Error(`Action ${action.id} has an invalid dependency`);
  let best={mask:0,value:-1,effort:0,count:0,covered:new Set()};const combinations=2**normalized.length;
  for(let mask=0;mask<combinations;mask++){
    let effort=0,valid=true;const covered=new Set();let count=0;
    for(let i=0;i<normalized.length;i++)if(mask&(2**i)){const action=normalized[i];count++;effort+=action.effort;if(effort>capacity){valid=false;break;}for(const dep of action.dependencies)if(!(mask&(2**normalized.findIndex(a=>a.id===dep)))){valid=false;break;}if(!valid)break;action.covers.forEach(id=>covered.add(id));}
    if(!valid)continue;const value=[...covered].reduce((sum,id)=>sum+targetMap.get(id).weight,0);
    if(value>best.value||(value===best.value&&(effort<best.effort||(effort===best.effort&&(count<best.count||(count===best.count&&mask<best.mask))))))best={mask,value,effort,count,covered};
  }
  const selected=normalized.filter((_,i)=>best.mask&(2**i));const coveredTargets=targets.filter(t=>best.covered.has(t.id));const uncoveredTargets=targets.filter(t=>!best.covered.has(t.id));const totalValue=targets.reduce((sum,t)=>sum+t.weight,0);
  return {schemaVersion:'1.0.0',status:targets.length?'planned':'no_gaps',capacity,usedCapacity:round(best.effort),remainingCapacity:round(capacity-best.effort),objective:{coveredPriority:best.value,totalPriority:totalValue,coverageRate:totalValue?round(best.value/totalValue):1,method:'exact bounded subset optimization with dependency and capacity constraints',optimal:true,combinationsEvaluated:combinations},selectedActions:selected,coveredTargets,uncoveredTargets,allActions:normalized};
}

export function planFromIntegrity(integrity,capacity){const backlog=deriveResearchBacklog(integrity).sort((a,b)=>(severityWeight[b.sourceFinding.severity]??1)-(severityWeight[a.sourceFinding.severity]??1)||a.id.localeCompare(b.id));const admitted=backlog.slice(0,16);return {...optimizeResearchPortfolio({integrity,actions:admitted,capacity}),deferredCatalogActions:backlog.slice(16)};}
