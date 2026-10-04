const required=(value,name,max=500)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${name} must contain 1–${max} characters`);return value.trim();};
const timestamp=(value,name)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||Number.isNaN(Date.parse(value)))throw new Error(`${name} must be an ISO timestamp`);return new Date(value).toISOString();};
const integer=(value,name,min,max)=>{if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${name} must be an integer from ${min} to ${max}`);return value;};
const finite=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${name} must be a finite number`);return value;};
const check=(id,passed,detail)=>({id,passed,detail});

function normalizeSnapshots(rawSnapshots,rollout,proposal,asOf){
  if(!Array.isArray(rawSnapshots)||!rawSnapshots.length||rawSnapshots.length>20)throw new Error(`${rollout} requires 1–20 snapshots`);
  const expected=proposal.rolloutSteps;
  const monitorMap=new Map(proposal.monitors.map(monitor=>[monitor.name,monitor]));
  const ids=new Set();let previousTime=Date.parse(proposal.effectiveAt)-1;let previousPercent=0;
  return rawSnapshots.map((raw,index)=>{
    const id=required(raw.id,`${rollout} snapshot ${index+1} id`,80);if(ids.has(id))throw new Error(`${rollout} snapshot IDs must be unique`);ids.add(id);
    const observedAt=timestamp(raw.observedAt,`${id} observedAt`);const observedTime=Date.parse(observedAt);
    if(observedTime<=previousTime||observedTime>Date.parse(asOf))throw new Error(`${rollout} snapshots must be chronological and not after asOf`);previousTime=observedTime;
    const percent=integer(raw.percent,`${id} percent`,1,100);if(percent<=previousPercent)throw new Error(`${rollout} snapshot percentages must increase`);previousPercent=percent;
    if(!Array.isArray(raw.monitorValues)||raw.monitorValues.length!==monitorMap.size)throw new Error(`${id} must report every declared monitor`);
    const names=new Set();const monitorValues=raw.monitorValues.map(item=>{const name=required(item.name,`${id} monitor name`,120);if(names.has(name)||!monitorMap.has(name))throw new Error(`${id} monitor values must be unique and declared`);names.add(name);return{name,value:finite(item.value,`${id} ${name} value`)};});
    return{id,observedAt,percent,version:required(raw.version,`${id} version`,40),monitorValues,evidence:required(raw.evidence,`${id} evidence`,1000)};
  });
}

function assessRollout(raw,index,proposal,asOf){
  const id=required(raw.id,`Rollout ${index+1} id`,80);
  const activatedAt=timestamp(raw.activatedAt,`${id} activatedAt`);if(Date.parse(activatedAt)>Date.parse(asOf))throw new Error(`${id} cannot activate after asOf`);
  const snapshots=normalizeSnapshots(raw.snapshots,id,proposal,asOf);
  if(snapshots.some(snapshot=>Date.parse(snapshot.observedAt)<Date.parse(activatedAt)))throw new Error(`${id} snapshots cannot precede activation`);
  const reviewedAt=timestamp(raw.review?.reviewedAt,`${id} review reviewedAt`);if(Date.parse(reviewedAt)>Date.parse(asOf)||Date.parse(reviewedAt)<Date.parse(snapshots.at(-1).observedAt))throw new Error(`${id} review must follow snapshots and not exceed asOf`);
  const decision=required(raw.review?.decision,`${id} review decision`,20);if(!['continue','pause','rollback'].includes(decision))throw new Error(`${id} review decision is invalid`);
  const stageSequence=snapshots.length===proposal.rolloutSteps.length&&snapshots.every((snapshot,i)=>snapshot.percent===proposal.rolloutSteps[i].percent);
  const dwellPassed=stageSequence&&snapshots.every((snapshot,i)=>{
    const end=i+1<snapshots.length?Date.parse(snapshots[i+1].observedAt):Date.parse(asOf);
    return Math.floor((end-Date.parse(snapshot.observedAt))/86_400_000)>=proposal.rolloutSteps[i].minimumDays;
  });
  const versionPassed=snapshots.every(snapshot=>snapshot.version===proposal.toVersion);
  const monitorChecks=[];
  for(const snapshot of snapshots){for(const value of snapshot.monitorValues){const monitor=proposal.monitors.find(item=>item.name===value.name);const passed=monitor.direction==='above'?value.value<=monitor.threshold:value.value>=monitor.threshold;monitorChecks.push({snapshotId:snapshot.id,name:value.name,value:value.value,threshold:monitor.threshold,direction:monitor.direction,passed});}}
  const monitorsPassed=monitorChecks.every(item=>item.passed);
  const checks=[
    check('approved-change',proposal.status==='ready_to_activate'&&proposal.review?.decision==='approve','Project 34 must mark the change ready to activate.'),
    check('activation-timing',Date.parse(activatedAt)>=Date.parse(proposal.effectiveAt),'Activation must not precede the approved effective date.'),
    check('stage-sequence',stageSequence,'Snapshots must cover each approved rollout percentage in order.'),
    check('minimum-dwell',dwellPassed,'Every rollout stage must complete its minimum observation period.'),
    check('target-version',versionPassed,`Every snapshot must observe approved version ${proposal.toVersion}.`),
    check('monitor-thresholds',monitorsPassed,'Every declared monitor must remain within its approved threshold.'),
    check('snapshot-evidence',snapshots.every(snapshot=>Boolean(snapshot.evidence)),'Every rollout stage includes evidence.'),
  ];
  const allPassed=checks.every(item=>item.passed);
  return{id,proposalId:proposal.id,policyId:proposal.policyId,fromVersion:proposal.fromVersion,toVersion:proposal.toVersion,activatedAt,snapshots,monitorChecks,checks,status:decision==='continue'?(allPassed?'verified_rollout':'blocked_continue'):'action_required',review:{reviewer:required(raw.review.reviewer,`${id} review reviewer`,120),decision,rationale:required(raw.review.rationale,`${id} review rationale`,1000),reviewedAt}};
}

export function monitorPlanningPolicyRollouts(runs,changeReport,input={}){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');
  if(changeReport?.schemaVersion!=='1.0.0'||!Array.isArray(changeReport.proposals))throw new Error('Provide a Project 34 planning policy change report');
  const asOf=timestamp(input.asOf,'asOf');if(Date.parse(changeReport.asOf)>Date.parse(asOf))throw new Error('Project 34 report occurs after asOf');
  if(!Array.isArray(input.rollouts)||!input.rollouts.length||input.rollouts.length>50)throw new Error('Provide 1–50 policy rollout reviews');
  const proposals=new Map(changeReport.proposals.map(proposal=>[proposal.id,proposal]));const ids=new Set();const proposalIds=new Set();
  const rollouts=input.rollouts.map((raw,index)=>{const id=required(raw.id,`Rollout ${index+1} id`,80);if(ids.has(id))throw new Error('Rollout IDs must be unique');ids.add(id);const proposalId=required(raw.proposalId,`${id} proposalId`,80);if(proposalIds.has(proposalId))throw new Error('Each policy change may have only one rollout review');proposalIds.add(proposalId);const proposal=proposals.get(proposalId);if(!proposal)throw new Error(`${id} must reference a Project 34 proposal`);return assessRollout(raw,index,proposal,asOf);});
  const summary=rollouts.reduce((result,rollout)=>{result[rollout.status]++;return result;},{verified_rollout:0,blocked_continue:0,action_required:0});
  return{schemaVersion:'1.0.0',asOf,sourcePolicyChangeAsOf:changeReport.asOf,sourcePolicyChangeIds:rollouts.map(rollout=>rollout.proposalId),sourceOutcomeReviewIds:[...(changeReport.sourceOutcomeReviewIds??[])],status:summary.blocked_continue?'blocked_continue':summary.action_required?'action_required':'verified_rollout',summary:{rollouts:rollouts.length,...summary},rollouts,method:'deterministic activation timing, staged coverage, dwell, version, monitor-threshold, and evidence verification; this monitor never continues, pauses, or rolls back a policy'};
}

