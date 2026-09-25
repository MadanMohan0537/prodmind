const required=(value,name,max=500)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${name} must contain 1–${max} characters`);return value.trim()};
const timestamp=(value,name)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||Number.isNaN(Date.parse(value)))throw new Error(`${name} must be an ISO timestamp`);return new Date(value).toISOString()};
const daysBetween=(left,right)=>(Date.parse(right)-Date.parse(left))/86_400_000;

function validateReport(report){if(report?.schemaVersion!=='1.0.0'||!Array.isArray(report.monitors))throw new Error('Provide a Project 25 governance-monitor report')}

export function governExceptions(runs,report,input={}){
  if(!Array.isArray(runs)||runs.length>50)throw new Error('Provide an array of at most 50 product runs');validateReport(report);
  if(!Array.isArray(input.registers)||!input.registers.length||input.registers.length>50)throw new Error('Provide 1–50 exception registers');
  const monitors=new Map(report.monitors.map(item=>[item.id,item]));const registerIds=new Set();const registers=[];
  for(const[index,raw]of input.registers.entries()){
    const id=required(raw.id,`Register ${index+1} id`,80);if(registerIds.has(id))throw new Error('Register IDs must be unique');registerIds.add(id);
    const monitorId=required(raw.monitorId,`${id} monitorId`,80);const monitor=monitors.get(monitorId);if(!monitor)throw new Error(`Unknown governance monitor: ${monitorId}`);const asOf=timestamp(raw.asOf,`${id} asOf`);
    if(!Array.isArray(raw.exceptions)||!raw.exceptions.length||raw.exceptions.length>100)throw new Error(`${id} must contain 1–100 exceptions`);
    const exceptionIds=new Set();const activeTargets=new Set();const exceptions=raw.exceptions.map((item,itemIndex)=>{
      const exceptionId=required(item.id,`${id} exception ${itemIndex+1} id`,80);if(exceptionIds.has(exceptionId))throw new Error(`${id} exception IDs must be unique`);exceptionIds.add(exceptionId);
      const targetType=required(item.targetType,`${id} ${exceptionId} targetType`,20);if(!['check','obligation'].includes(targetType))throw new Error(`${id} ${exceptionId} targetType is invalid`);const targetId=required(item.targetId,`${id} ${exceptionId} targetId`,80);
      const targetExists=targetType==='check'?monitor.checks?.some(check=>check.id===targetId):monitor.obligations?.some(obligation=>obligation.id===targetId);if(!targetExists)throw new Error(`${id} ${exceptionId} target does not exist`);
      const targetFailing=targetType==='check'?monitor.failedChecks?.includes(targetId):monitor.obligations.some(obligation=>obligation.id===targetId&&(obligation.overdue||!obligation.evidenceComplete));
      const requester=required(item.requester,`${id} ${exceptionId} requester`,120);const owner=required(item.owner,`${id} ${exceptionId} owner`,120);const rationale=required(item.rationale,`${id} ${exceptionId} rationale`,1000);
      const riskRating=required(item.riskRating,`${id} ${exceptionId} riskRating`,20);if(!['low','medium','high','critical'].includes(riskRating))throw new Error(`${id} ${exceptionId} riskRating is invalid`);
      const requestedAt=timestamp(item.requestedAt,`${id} ${exceptionId} requestedAt`);const expiresAt=timestamp(item.expiresAt,`${id} ${exceptionId} expiresAt`);if(Date.parse(requestedAt)>Date.parse(asOf))throw new Error(`${id} ${exceptionId} request cannot occur after asOf`);
      const controls=(item.compensatingControls??[]).map((control,controlIndex)=>({id:required(control.id,`${id} ${exceptionId} control ${controlIndex+1} id`,80),owner:required(control.owner,`${id} ${exceptionId} control ${controlIndex+1} owner`,120),description:required(control.description,`${id} ${exceptionId} control ${controlIndex+1} description`,500),evidence:required(control.evidence,`${id} ${exceptionId} control ${controlIndex+1} evidence`,1000),reviewedAt:timestamp(control.reviewedAt,`${id} ${exceptionId} control ${controlIndex+1} reviewedAt`)}));
      if(new Set(controls.map(control=>control.id)).size!==controls.length)throw new Error(`${id} ${exceptionId} control IDs must be unique`);
      const remediationObligationId=required(item.remediationObligationId,`${id} ${exceptionId} remediationObligationId`,80);const remediation=monitor.obligations?.find(obligation=>obligation.id===remediationObligationId);
      const approvals=(item.approvals??[]).map((approval,approvalIndex)=>{const role=required(approval.role,`${id} ${exceptionId} approval ${approvalIndex+1} role`,40).toLowerCase();const decision=required(approval.decision,`${id} ${exceptionId} approval ${approvalIndex+1} decision`,20);if(!['approved','rejected'].includes(decision))throw new Error(`${id} ${exceptionId} approval decision is invalid`);return{role,reviewer:required(approval.reviewer,`${id} ${exceptionId} approval ${approvalIndex+1} reviewer`,120),decision,reviewedAt:timestamp(approval.reviewedAt,`${id} ${exceptionId} approval ${approvalIndex+1} reviewedAt`)}});
      if(new Set(approvals.map(approval=>approval.role)).size!==approvals.length)throw new Error(`${id} ${exceptionId} approval roles must be unique`);
      const reviewRaw=item.review??{};const decision=required(reviewRaw.decision,`${id} ${exceptionId} review decision`,20);if(!['approve','reject','close'].includes(decision))throw new Error(`${id} ${exceptionId} review decision is invalid`);const review={reviewer:required(reviewRaw.reviewer,`${id} ${exceptionId} review reviewer`,120),decision,rationale:required(reviewRaw.rationale,`${id} ${exceptionId} review rationale`,1000),reviewedAt:timestamp(reviewRaw.reviewedAt,`${id} ${exceptionId} review reviewedAt`)};if(Date.parse(review.reviewedAt)>Date.parse(asOf)||Date.parse(review.reviewedAt)<Date.parse(requestedAt))throw new Error(`${id} ${exceptionId} review timing is invalid`);
      const maxDays={low:180,medium:90,high:30,critical:7}[riskRating];const requiredRoles=['product','governance',...(['high','critical'].includes(riskRating)?['risk']:[])];const reviewers=approvals.map(approval=>approval.reviewer.toLowerCase());
      const checks=[
        {id:'target-failing',passed:targetFailing,detail:`${targetType} ${targetId}`},
        {id:'time-bounded',passed:Date.parse(expiresAt)>Date.parse(requestedAt)&&daysBetween(requestedAt,expiresAt)<=maxDays&&(decision!=='approve'||Date.parse(asOf)<=Date.parse(expiresAt)),detail:`${daysBetween(requestedAt,expiresAt)} days; maximum ${maxDays}`},
        {id:'compensating-controls',passed:controls.length>0&&controls.every(control=>Date.parse(control.reviewedAt)<=Date.parse(asOf)),detail:`${controls.length} evidenced controls`},
        {id:'remediation-linked',passed:Boolean(remediation&&remediation.status==='open'),detail:remediation?`${remediation.id}: ${remediation.status}`:'missing'},
        {id:'required-approvals',passed:requiredRoles.every(role=>approvals.some(approval=>approval.role===role&&approval.decision==='approved'))&&!approvals.some(approval=>approval.decision==='rejected'),detail:`required: ${requiredRoles.join(', ')}`},
        {id:'approval-separation',passed:review.reviewer.toLowerCase()!==requester.toLowerCase()&&!reviewers.includes(requester.toLowerCase())&&new Set(reviewers).size===reviewers.length,detail:`requester ${requester}; reviewer ${review.reviewer}`},
        {id:'approval-timing',passed:approvals.every(approval=>Date.parse(approval.reviewedAt)>=Date.parse(requestedAt)&&Date.parse(approval.reviewedAt)<=Date.parse(asOf)),detail:`requested ${requestedAt}`},
      ];
      const activeKey=`${targetType}:${targetId}`;if(decision==='approve'){if(activeTargets.has(activeKey))throw new Error(`${id} cannot contain multiple active exceptions for ${activeKey}`);activeTargets.add(activeKey)}
      const applicable=decision==='approve'?checks:decision==='close'?[checks[0]]:[];const failedChecks=applicable.filter(check=>decision==='close'?check.passed:!check.passed).map(check=>check.id);
      const status=decision==='approve'?(failedChecks.length?'blocked_approval':'active_exception'):decision==='reject'?'rejected':failedChecks.length?'blocked_closure':'closed';
      return{id:exceptionId,targetType,targetId,targetFailing,requester,owner,rationale,riskRating,requestedAt,expiresAt,expired:Date.parse(asOf)>Date.parse(expiresAt),compensatingControls:controls,remediationObligationId,approvals,review,checks,failedChecks,status};
    });
    registers.push({id,monitorId,governancePackId:monitor.governancePackId,portfolioItemId:monitor.portfolioItemId,title:monitor.title,evidenceIds:[...(monitor.evidenceIds??[])],underlyingStatus:monitor.status,asOf,exceptions});
  }
  const all=registers.flatMap(register=>register.exceptions);return{schemaVersion:'1.0.0',summary:{registers:registers.length,exceptions:all.length,active:all.filter(item=>item.status==='active_exception').length,blockedApprovals:all.filter(item=>item.status==='blocked_approval').length,rejected:all.filter(item=>item.status==='rejected').length,closed:all.filter(item=>item.status==='closed').length,expired:all.filter(item=>item.expired).length},registers,method:'deterministic target, duration, compensating-control, remediation, approval-separation, and timing checks over Project 25 findings; an exception records temporary human risk acceptance and never changes the underlying monitor result'};
}
