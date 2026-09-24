const required=(value,name,max=500)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${name} must contain 1–${max} characters`);return value.trim()};
const timestamp=(value,name)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||Number.isNaN(Date.parse(value)))throw new Error(`${name} must be an ISO timestamp`);return new Date(value).toISOString()};
const integer=(value,name,min,max)=>{if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${name} must be an integer from ${min} to ${max}`);return value};
const addDays=(value,days)=>new Date(Date.parse(value)+days*86_400_000).toISOString();

function validateReport(report){
  if(report?.schemaVersion!=='1.0.0'||!Array.isArray(report.packs))throw new Error('Provide a Project 24 governance-pack report');
}

export function monitorGovernanceObligations(runs,report,input={}){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');
  validateReport(report);
  if(!Array.isArray(input.monitors)||!input.monitors.length||input.monitors.length>50)throw new Error('Provide 1–50 governance monitors');
  const packs=new Map(report.packs.map(pack=>[pack.id,pack]));
  const ids=new Set();const monitors=[];
  for(const [index,raw] of input.monitors.entries()){
    const id=required(raw.id,`Monitor ${index+1} id`,80);if(ids.has(id))throw new Error('Monitor IDs must be unique');ids.add(id);
    const governancePackId=required(raw.governancePackId,`${id} governancePackId`,80);const pack=packs.get(governancePackId);if(!pack)throw new Error(`Unknown governance pack: ${governancePackId}`);
    const asOf=timestamp(raw.asOf,`${id} asOf`);const observedPackDigest=required(raw.observedPackDigest,`${id} observedPackDigest`,64).toLowerCase();if(!/^[a-f0-9]{64}$/.test(observedPackDigest))throw new Error(`${id} observedPackDigest must be a SHA-256 hex digest`);
    const reviewIntervalDays=integer(raw.reviewIntervalDays,`${id} reviewIntervalDays`,1,365);const certificationValidDays=integer(raw.certificationValidDays,`${id} certificationValidDays`,1,1095);
    if(!Array.isArray(raw.obligations)||!raw.obligations.length||raw.obligations.length>100)throw new Error(`${id} must contain 1–100 obligations`);
    const obligationIds=new Set();const obligations=raw.obligations.map((item,itemIndex)=>{
      const obligationId=required(item.id,`${id} obligation ${itemIndex+1} id`,80);if(obligationIds.has(obligationId))throw new Error(`${id} obligation IDs must be unique`);obligationIds.add(obligationId);
      const type=required(item.type,`${id} ${obligationId} type`,40);if(!['evidence_refresh','approval_renewal','control_test','corrective_action','retention_disposition'].includes(type))throw new Error(`${id} ${obligationId} type is invalid`);
      const status=required(item.status,`${id} ${obligationId} status`,20);if(!['open','completed','waived'].includes(status))throw new Error(`${id} ${obligationId} status is invalid`);
      const dueAt=timestamp(item.dueAt,`${id} ${obligationId} dueAt`);const completedAt=item.completedAt==null?null:timestamp(item.completedAt,`${id} ${obligationId} completedAt`);const evidence=item.evidence==null?'':required(item.evidence,`${id} ${obligationId} evidence`,1000);
      if(status==='open'&&completedAt)throw new Error(`${id} ${obligationId} open obligation cannot have completedAt`);if(status!=='open'&&!completedAt)throw new Error(`${id} ${obligationId} requires completedAt`);
      return{id:obligationId,type,owner:required(item.owner,`${id} ${obligationId} owner`,120),dueAt,status,completedAt,evidence,overdue:status==='open'&&Date.parse(dueAt)<Date.parse(asOf),late:Boolean(completedAt&&Date.parse(completedAt)>Date.parse(dueAt)),evidenceComplete:status==='open'||Boolean(evidence)};
    });
    const reviewRaw=raw.review??{};const decision=required(reviewRaw.decision,`${id} review decision`,30);if(!['continue','remediate','recertify','dispose'].includes(decision))throw new Error(`${id} review decision is invalid`);
    const review={reviewer:required(reviewRaw.reviewer,`${id} review reviewer`,120),decision,rationale:required(reviewRaw.rationale,`${id} review rationale`,1000),reviewedAt:timestamp(reviewRaw.reviewedAt,`${id} review reviewedAt`)};
    if(Date.parse(review.reviewedAt)>Date.parse(asOf))throw new Error(`${id} review cannot occur after asOf`);
    const certificationAt=pack.review?.reviewedAt;const retentionAt=addDays(pack.generatedAt,pack.retentionDays);const nextReviewAt=addDays(review.reviewedAt,reviewIntervalDays);const certificationExpiresAt=addDays(certificationAt,certificationValidDays);const retentionExpired=Date.parse(asOf)>Date.parse(retentionAt);
    const checks=[
      {id:'upstream-certified',passed:pack.status==='certified',detail:pack.status},
      {id:'digest-continuity',passed:observedPackDigest===pack.packDigest,detail:`observed ${observedPackDigest.slice(0,12)}; authoritative ${String(pack.packDigest).slice(0,12)}`},
      {id:'obligations-on-time',passed:!obligations.some(item=>item.overdue),detail:`${obligations.filter(item=>item.overdue).length} overdue`},
      {id:'obligation-evidence',passed:obligations.every(item=>item.evidenceComplete),detail:`${obligations.filter(item=>!item.evidenceComplete).length} completed or waived without evidence`},
      {id:'review-current',passed:Date.parse(asOf)<=Date.parse(nextReviewAt),detail:`next review ${nextReviewAt}`},
      {id:'certification-current',passed:Date.parse(asOf)<=Date.parse(certificationExpiresAt),detail:`expires ${certificationExpiresAt}`},
      {id:'retention-decision',passed:retentionExpired?['dispose','recertify'].includes(decision):decision!=='dispose',detail:`retention ${retentionAt}; decision ${decision}`},
    ];
    const failedChecks=checks.filter(check=>!check.passed).map(check=>check.id);const status=decision==='continue'?(failedChecks.length?'blocked_continue':'current'):'action_required';
    monitors.push({id,governancePackId,portfolioItemId:pack.portfolioItemId,title:pack.title,evidenceIds:[...(pack.evidenceIds??[])],asOf,observedPackDigest,authoritativePackDigest:pack.packDigest,reviewIntervalDays,certificationValidDays,nextReviewAt,certificationExpiresAt,retentionAt,retentionExpired,obligations,review,checks,failedChecks,status});
  }
  return{schemaVersion:'1.0.0',summary:{monitors:monitors.length,current:monitors.filter(item=>item.status==='current').length,actionRequired:monitors.filter(item=>item.status==='action_required').length,blockedContinue:monitors.filter(item=>item.status==='blocked_continue').length,overdueObligations:monitors.flatMap(item=>item.obligations).filter(item=>item.overdue).length,digestMismatches:monitors.filter(item=>item.failedChecks.includes('digest-continuity')).length},monitors,method:'deterministic digest comparison, calendar checks, obligation evidence validation, retention control, and named human review over Project 24 governance packs; the monitor never disposes, recertifies, or changes a product'};
}
