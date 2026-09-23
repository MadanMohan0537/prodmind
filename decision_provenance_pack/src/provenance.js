const required = (value, name, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
};
const timestamp = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
};
const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
};

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical records cannot contain non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new Error('Canonical records support only JSON values');
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonicalize(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function validateReport(report, collection, project) {
  if (report?.schemaVersion !== '1.0.0' || !Array.isArray(report[collection])) throw new Error(`Provide a Project ${project} report`);
}

export async function buildDecisionProvenancePacks(runs, reports, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50) throw new Error('Provide an array of at most 50 product runs');
  validateReport(reports?.assumptions, 'assumptions', 18);
  validateReport(reports?.readiness, 'releases', 19);
  validateReport(reports?.adoption, 'journeys', 20);
  validateReport(reports?.lifecycle, 'plans', 21);
  validateReport(reports?.sunset, 'snapshots', 22);
  validateReport(reports?.outcomes, 'reviews', 23);
  if (!Array.isArray(input.packs) || !input.packs.length || input.packs.length > 50) throw new Error('Provide 1–50 governance packs');

  const outcomes = new Map(reports.outcomes.reviews.map(item => [item.id, item]));
  const ids = new Set();
  const packs = [];
  for (const [index, raw] of input.packs.entries()) {
    const id = required(raw.id, `Pack ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error('Pack IDs must be unique');
    ids.add(id);
    const outcomeReviewId = required(raw.outcomeReviewId, `${id} outcomeReviewId`, 80);
    const outcome = outcomes.get(outcomeReviewId);
    if (!outcome) throw new Error(`Unknown outcome review: ${outcomeReviewId}`);
    const generatedAt = timestamp(raw.generatedAt, `${id} generatedAt`);
    const owner = required(raw.owner, `${id} owner`, 120);
    const purpose = required(raw.purpose, `${id} purpose`, 1000);
    const classification = required(raw.classification, `${id} classification`, 20);
    if (!['internal', 'confidential', 'restricted'].includes(classification)) throw new Error(`${id} classification is invalid`);
    const retentionDays = integer(raw.retentionDays, `${id} retentionDays`, 30, 3650);

    const assumptions = reports.assumptions.assumptions.filter(item => outcome.assumptionIds.includes(item.id));
    const release = reports.readiness.releases.find(item => item.id === outcome.releaseId);
    const journey = reports.adoption.journeys.find(item => item.id === outcome.journeyId);
    const lifecycle = reports.lifecycle.plans.find(item => item.id === outcome.planId);
    const sunset = reports.sunset.snapshots.find(item => item.id === outcome.snapshotId);
    const artifactPayloads = [
      {type:'evidence_lineage', id:outcome.portfolioItemId, payload:{portfolioItemId:outcome.portfolioItemId,evidenceIds:outcome.evidenceIds,shipDecisionIds:outcome.shipDecisionIds}},
      {type:'assumptions', id:outcome.assumptionIds.join(',') || 'none', payload:assumptions},
      {type:'release', id:outcome.releaseId, payload:release},
      {type:'adoption', id:outcome.journeyId, payload:journey},
      {type:'lifecycle', id:outcome.planId, payload:lifecycle},
      {type:'sunset', id:outcome.snapshotId, payload:sunset},
      {type:'outcome', id:outcome.id, payload:outcome},
    ];
    const artifacts = [];
    let previousDigest = null;
    for (const artifact of artifactPayloads) {
      const digest = await sha256({type:artifact.type,id:artifact.id,payload:artifact.payload,previousDigest});
      artifacts.push({type:artifact.type,id:artifact.id,digest,previousDigest});
      previousDigest = digest;
    }

    const reviewRaw = raw.review ?? {};
    const decision = required(reviewRaw.decision, `${id} review decision`, 30);
    if (!['certify', 'needs_correction', 'archive'].includes(decision)) throw new Error(`${id} review decision is invalid`);
    const review = {
      author: required(reviewRaw.author, `${id} review author`, 120),
      certifier: required(reviewRaw.certifier, `${id} review certifier`, 120),
      decision,
      rationale: required(reviewRaw.rationale, `${id} review rationale`, 1000),
      reviewedAt: timestamp(reviewRaw.reviewedAt, `${id} review reviewedAt`),
    };
    const approvals = (raw.approvals ?? []).map((approval, approvalIndex) => {
      const role = required(approval.role, `${id} approval ${approvalIndex + 1} role`, 40).toLowerCase();
      const choice = required(approval.decision, `${id} approval ${approvalIndex + 1} decision`, 20);
      if (!['approved', 'rejected'].includes(choice)) throw new Error(`${id} approval decision is invalid`);
      return {role,reviewer:required(approval.reviewer,`${id} approval ${approvalIndex + 1} reviewer`,120),decision:choice,reviewedAt:timestamp(approval.reviewedAt,`${id} approval ${approvalIndex + 1} reviewedAt`)};
    });
    if (new Set(approvals.map(item => item.role)).size !== approvals.length) throw new Error(`${id} approval roles must be unique`);
    const requiredRoles = ['product','engineering','governance'];
    const retentionMinimum = {internal:30,confidential:365,restricted:730}[classification];
    const reviewers = approvals.map(item => item.reviewer.toLowerCase());
    const checks = [
      {id:'upstream-closed',passed:outcome.status==='closed',detail:outcome.status},
      {id:'artifact-coverage',passed:artifactPayloads.every(item=>item.payload!==undefined)&&assumptions.length===outcome.assumptionIds.length,detail:`${artifacts.length} artifacts; ${assumptions.length} assumptions`},
      {id:'lineage-complete',passed:Boolean(outcome.portfolioItemId&&outcome.evidenceIds.length&&outcome.releaseId&&outcome.journeyId&&outcome.planId&&outcome.snapshotId),detail:`${outcome.evidenceIds.length} evidence IDs`},
      {id:'review-separation',passed:review.author.toLowerCase()!==review.certifier.toLowerCase()&&!reviewers.includes(review.author.toLowerCase())&&new Set(reviewers).size===reviewers.length,detail:`author ${review.author}; certifier ${review.certifier}`},
      {id:'required-approvals',passed:requiredRoles.every(role=>approvals.some(item=>item.role===role&&item.decision==='approved'))&&!approvals.some(item=>item.decision==='rejected'),detail:`required: ${requiredRoles.join(', ')}`},
      {id:'review-freshness',passed:new Date(review.reviewedAt)>=new Date(generatedAt)&&new Date(review.reviewedAt)>=new Date(outcome.reviewedAt),detail:`generated ${generatedAt}`},
      {id:'retention-policy',passed:retentionDays>=retentionMinimum,detail:`${retentionDays} days; minimum ${retentionMinimum}`},
    ];
    const failedChecks = checks.filter(check => !check.passed).map(check => check.id);
    const packDigest = await sha256({id,outcomeReviewId,generatedAt,owner,purpose,classification,retentionDays,artifacts,approvals,review});
    const status = decision === 'certify' ? (failedChecks.length ? 'blocked_certification' : 'certified') : 'action_required';
    packs.push({id,outcomeReviewId,portfolioItemId:outcome.portfolioItemId,title:outcome.title,evidenceIds:[...outcome.evidenceIds],generatedAt,owner,purpose,classification,retentionDays,artifacts,chainHead:previousDigest,packDigest,approvals,review,checks,failedChecks,status});
  }
  return {schemaVersion:'1.0.0',summary:{packs:packs.length,certified:packs.filter(item=>item.status==='certified').length,actionRequired:packs.filter(item=>item.status==='action_required').length,blockedCertification:packs.filter(item=>item.status==='blocked_certification').length},packs,method:'deterministic canonical JSON records, SHA-256 artifact chain, governance checks, and named human certification over Projects 18–23; digests are integrity checks, not digital signatures or legal compliance'};
}
