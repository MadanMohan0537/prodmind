const round=value=>Number(value.toFixed(4));
const resolvedStatuses=new Map([['sustained',1],['below_target',0],['at_risk',0]]);

export function forecastsFromRuns(runs){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');
  const forecasts=[];const unresolved=[];
  for(const run of runs){
    if(!run||!Array.isArray(run.experiments))throw new Error('Each product run must contain experiments');
    for(const experiment of run.experiments){
      if(!experiment.decision)continue;
      const opportunity=run.ranking?.ranked?.find(item=>item.id===experiment.opportunityId)??experiment.opportunitySnapshot;
      const confidence=opportunity?.confidence;
      if(!Number.isFinite(confidence)||confidence<0||confidence>1)continue;
      const review=(experiment.outcomeReviews??[]).at(-1);const status=review?.analysis?.status??'unmonitored';
      const record={runId:run.id,runTitle:run.title,opportunityId:experiment.opportunityId,opportunityTitle:opportunity.title,experimentId:experiment.id,decisionId:experiment.decision.id??experiment.decision.auditId,monitorId:review?.monitorId??null,evidenceIds:[...experiment.evidenceIds],confidence,status,decision:experiment.decision.outcome,decidedAt:experiment.decision.decidedAt};
      if(resolvedStatuses.has(status))forecasts.push({...record,observed:resolvedStatuses.get(status)});else unresolved.push(record);
    }
  }
  return {forecasts,unresolved};
}

export function calibrateDecisions(input){
  const records=input?.forecasts;if(!Array.isArray(records)||records.length>500)throw new Error('Provide an array of at most 500 resolved forecasts');
  const normalized=records.map((record,index)=>{
    if(!Number.isFinite(record.confidence)||record.confidence<0||record.confidence>1)throw new Error(`Forecast ${index+1} confidence must be 0–1`);
    if(record.observed!==0&&record.observed!==1)throw new Error(`Forecast ${index+1} observed must be 0 or 1`);
    return {...record,confidence:Number(record.confidence),observed:record.observed};
  });
  const n=normalized.length;if(!n)return {schemaVersion:'1.0.0',sampleSize:0,status:'insufficient_data',warning:'No resolved monitored decisions are available.',metrics:null,bins:[],forecasts:[]};
  const meanForecast=normalized.reduce((sum,row)=>sum+row.confidence,0)/n;const observedRate=normalized.reduce((sum,row)=>sum+row.observed,0)/n;
  const brier=normalized.reduce((sum,row)=>sum+(row.confidence-row.observed)**2,0)/n;
  const bins=[];for(let start=0;start<1;start+=.2){const end=round(start+.2);const members=normalized.filter(row=>row.confidence>=start&&(end===1?row.confidence<=end:row.confidence<end));if(!members.length)continue;const predicted=members.reduce((sum,row)=>sum+row.confidence,0)/members.length;const observed=members.reduce((sum,row)=>sum+row.observed,0)/members.length;bins.push({range:[round(start),end],count:members.length,meanConfidence:round(predicted),observedRate:round(observed),gap:round(predicted-observed)});}
  return {schemaVersion:'1.0.0',sampleSize:n,status:n<20?'directional_only':'review',warning:n<20?'Fewer than 20 resolved decisions; calibration estimates are unstable and directional only.':'Review bin sizes and context before changing decision policy.',metrics:{brierScore:round(brier),meanConfidence:round(meanForecast),observedSuccessRate:round(observedRate),confidenceBias:round(meanForecast-observedRate),meanAbsoluteError:round(normalized.reduce((sum,row)=>sum+Math.abs(row.confidence-row.observed),0)/n)},bins,forecasts:normalized,interpretation:'Observed success is a monitoring-status proxy, not proof that the decision caused the outcome. Brier score combines calibration and resolution; inspect reliability bins separately.'};
}

export function calibrateRuns(runs){const extracted=forecastsFromRuns(runs);return {...calibrateDecisions({forecasts:extracted.forecasts}),unresolved:extracted.unresolved};}
