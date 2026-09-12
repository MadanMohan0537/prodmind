const round=value=>Number(value.toFixed(4));
const DAY=86_400_000;

function settings(input={}){
  const result={maxAgeDays:input.maxAgeDays??90,minSources:input.minSources??2,minSegments:input.minSegments??2,maxSourceShare:input.maxSourceShare??.7,minEvidence:input.minEvidence??5};
  for(const [key,value] of Object.entries(result))if(!Number.isFinite(value)||value<=0)throw new Error(`${key} must be a positive number`);
  if(result.maxSourceShare>1)throw new Error('maxSourceShare must be at most 1');
  return result;
}
const countBy=(items,key)=>Object.fromEntries([...items.reduce((map,item)=>map.set(key(item),(map.get(key(item))??0)+1),new Map())].sort());

function assessOpportunity(run,opportunity,evidenceById,asOf,policy){
  const ids=Array.isArray(opportunity.evidenceIds)?[...new Set(opportunity.evidenceIds)]:[];
  const missingEvidenceIds=ids.filter(id=>!evidenceById.has(id));
  const evidence=ids.map(id=>evidenceById.get(id)).filter(Boolean);
  const sources=countBy(evidence,item=>item.source||'unknown');
  const segments=countBy(evidence,item=>item.segment||'unknown');
  const ages=evidence.map(item=>(asOf-Date.parse(item.createdAt))/DAY);
  if(ages.some(age=>!Number.isFinite(age)||age<0))throw new Error('Evidence dates must be valid and not later than asOf');
  const staleCount=ages.filter(age=>age>policy.maxAgeDays).length;
  const largestSourceShare=evidence.length?Math.max(...Object.values(sources))/evidence.length:0;
  const sourceConcentration=evidence.length?Object.values(sources).reduce((sum,n)=>sum+(n/evidence.length)**2,0):0;
  const unknownSegmentShare=evidence.length?(segments.unknown??0)/evidence.length:0;
  const sentiments=countBy(evidence,item=>item.sentiment?.label||'unknown');
  const polarized=(sentiments.positive??0)/Math.max(1,evidence.length)>=.2&&(sentiments.negative??0)/Math.max(1,evidence.length)>=.2;
  const findings=[];
  const add=(code,severity,message,penalty)=>findings.push({code,severity,message,penalty});
  if(missingEvidenceIds.length)add('broken_lineage','blocker',`${missingEvidenceIds.length} evidence IDs do not resolve`,50);
  if(evidence.length<policy.minEvidence)add('small_sample','high',`Only ${evidence.length} linked evidence records`,20);
  if(staleCount)add('stale_evidence',staleCount/evidence.length>.5?'high':'medium',`${staleCount} records are older than ${policy.maxAgeDays} days`,staleCount/evidence.length>.5?25:10);
  if(Object.keys(sources).length<policy.minSources)add('source_gap','medium',`Evidence covers ${Object.keys(sources).length} source(s)`,12);
  if(largestSourceShare>policy.maxSourceShare)add('source_concentration','high',`${Math.round(largestSourceShare*100)}% of evidence comes from one source`,18);
  if(Object.keys(segments).filter(segment=>segment!=='unknown').length<policy.minSegments)add('segment_gap','medium','Customer-segment coverage is below policy',12);
  if(unknownSegmentShare>.5)add('unknown_segments','medium',`${Math.round(unknownSegmentShare*100)}% of evidence has no segment`,10);
  if(polarized)add('polarized_signal','review','Positive and negative evidence both exceed 20%; inspect segment and context differences',5);
  const integrityScore=Math.max(0,100-findings.reduce((sum,item)=>sum+item.penalty,0));
  return {portfolioItemId:`${run.id}:${opportunity.id}`,runId:run.id,runTitle:run.title,opportunityId:opportunity.id,opportunityTitle:opportunity.title,evidenceIds:ids,missingEvidenceIds,integrityScore,status:findings.some(f=>f.severity==='blocker')?'blocked':integrityScore<60?'high_risk':integrityScore<80?'review':'healthy',metrics:{evidenceCount:evidence.length,staleCount,staleShare:round(staleCount/Math.max(1,evidence.length)),sourceCount:Object.keys(sources).length,largestSourceShare:round(largestSourceShare),sourceConcentration:round(sourceConcentration),knownSegmentCount:Object.keys(segments).filter(s=>s!=='unknown').length,unknownSegmentShare:round(unknownSegmentShare)},distributions:{sources,segments,sentiments},findings};
}

export function assessEvidenceIntegrity(runs,input={}){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');
  const policy=settings(input);const asOf=Date.parse(input.asOf??new Date().toISOString());
  if(!Number.isFinite(asOf))throw new Error('asOf must be a valid timestamp');
  const assessments=[];
  for(const run of runs){
    if(!run||!Array.isArray(run.evidence))throw new Error('Each run must contain evidence');
    const evidenceById=new Map(run.evidence.map(item=>[item.id,item]));
    const opportunities=run.ranking?.ranked??run.opportunities??[];
    for(const opportunity of opportunities)assessments.push(assessOpportunity(run,opportunity,evidenceById,asOf,policy));
  }
  assessments.sort((a,b)=>a.integrityScore-b.integrityScore||a.portfolioItemId.localeCompare(b.portfolioItemId));
  const counts=Object.fromEntries(['blocked','high_risk','review','healthy'].map(status=>[status,assessments.filter(a=>a.status===status).length]));
  return {schemaVersion:'1.0.0',generatedAt:new Date(asOf).toISOString(),policy,summary:{runs:runs.length,opportunities:assessments.length,meanIntegrityScore:assessments.length?round(assessments.reduce((sum,a)=>sum+a.integrityScore,0)/assessments.length):null,needsAttention:counts.blocked+counts.high_risk+counts.review,statuses:counts},assessments,method:'deterministic evidence fitness checks; findings require product and research review'};
}
