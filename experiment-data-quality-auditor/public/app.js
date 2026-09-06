const $ = selector => document.querySelector(selector);
let token = '', run = null, assessments = [];
const el = (tag, text, className) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;};
const notice = (text, error = false) => {$('#notice').textContent = text; $('#notice').className = error ? 'error' : '';};
async function api(path, payload) {
  if (!token) throw new Error('Connect using your workspace token first.');
  const response = await fetch(path, {method: payload ? 'POST' : 'GET', headers: {Authorization: `Bearer ${token}`, ...(payload ? {'Content-Type': 'application/json'} : {})}, ...(payload ? {body: JSON.stringify(payload)} : {})});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}
async function action(fn) {
  const buttons = [...document.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
  try {await fn();} catch (e) {notice(e.message, true);} finally {buttons.forEach(b => b.disabled = false);}
}
const values = form => Object.fromEntries(new FormData(form));
async function loadRuns() {
  const {runs} = await api('/api/runs'); $('#runs').replaceChildren();
  for (const item of runs) {
    const button = el('button', `${item.title} · ${item.stage}`);
    button.onclick = () => action(async () => {run = await api(`/api/runs/${item.id}`); assessments = []; render(); notice('Saved run loaded.');});
    $('#runs').append(button);
  }
  if (!runs.length) $('#runs').append(el('p', 'No saved runs yet.', 'muted'));
}
$('#connect').onsubmit = event => {event.preventDefault(); token = $('#token').value; $('#token').value = ''; action(async () => {await loadRuns(); notice('Connected.');});};
$('#refresh').onclick = () => action(loadRuns);
$('#discovery').onsubmit = event => {event.preventDefault(); action(async () => {
  const form = event.currentTarget || $('#discovery'); const file = form.elements.file.files[0];
  if (!file || file.size > 2_000_000) throw new Error('Choose a JSON file under 2 MB.');
  const data = JSON.parse(await file.text());
  run = await api('/api/runs', {title: form.elements.title.value, records: Array.isArray(data) ? data : (data.records ?? data.data)});
  assessments = []; render(); await loadRuns(); notice('Feedback analyzed and saved across projects 1–5. Review candidates before ranking.');
});};
const factorRanges = {businessValue:[0,10],userValue:[0,10],strategicAlignment:[0,10],confidence:[0,1],feasibility:[0,1],urgency:[0,10],effort:[0.1,10000],risk:[0,1],uncertainty:[0,0.75]};
for (const [name,[min,max]] of Object.entries(factorRanges)) {
  const label = el('label', `${name.replace(/[A-Z]/g, x => ` ${x.toLowerCase()}`)} (${min}–${max})`);
  const input = el('input'); Object.assign(input,{name,type:'number',min:String(min),max:String(max),step:'any',required:true}); label.append(input); $('#factors').append(label);
}
$('#opportunity').onchange = () => {$('#assessment').elements.title.value = run.opportunities.find(o => o.id === $('#opportunity').value)?.title ?? '';};
$('#assessment').onsubmit = event => {
  event.preventDefault(); const data = values(event.currentTarget); data.id = $('#opportunity').value; data.reviewed = true;
  for (const field of Object.keys(factorRanges)) data[field] = Number(data[field]);
  data.dependencies = data.dependencies.split(',').map(x => x.trim()).filter(Boolean);
  assessments = [...assessments.filter(a => a.id !== data.id), data];
  $('#assessment-count').textContent = `${assessments.length} assessments prepared. Save ranking to persist them.`;
};
$('#rank').onsubmit = event => {event.preventDefault(); action(async () => {await mutate('rank', {assessments, capacity:Number($('#rank').elements.capacity.value)}); notice('Project 6 ranking saved with original evidence links.');});};
$('#experiment').onsubmit = event => {event.preventDefault(); action(async () => {
  const data = values($('#experiment')); data.minimumPerArm = Number(data.minimumPerArm);
  data.startsAt = new Date(data.startsAt + 'Z').toISOString(); data.endsAt = new Date(data.endsAt + 'Z').toISOString();
  data.guardrails = [{name:data.guardrailName,criterion:data.guardrailCriterion}];
  await mutate('experiments', data); notice('Experiment draft saved. Lock it before prospective exposure begins.');
});};
async function mutate(path, payload) {
  run = await api(`/api/runs/${run.id}/${path}`, {...payload, version:run.version}); render();
}
function options(select, items) {select.replaceChildren(); for (const item of items) {const option = el('option', `${item.title} (${item.id})`); option.value = item.id; select.append(option);}}
function details(parent, title, value) {const d = el('details'); d.append(el('summary', title),el('pre',JSON.stringify(value,null,2))); parent.append(d);}
function render() {
  $('#workspace').hidden = false; $('#empty').hidden = true; $('#run-title').textContent = run.title;
  $('#run-status').textContent = `${run.stage} · revision ${run.version} · ${run.id}`;
  $('#summary').replaceChildren();
  for (const [label,count] of Object.entries({Evidence:run.evidence.length,Topics:run.topics.topicCount,'Needs sentiment review':run.evidence.filter(e=>e.sentiment.needsReview).length,Experiments:run.experiments.length})) {
    const tile = el('div', undefined,'metric'); tile.append(el('strong',String(count)),el('span',label)); $('#summary').append(tile);
  }
  $('#evidence').replaceChildren();
  details($('#evidence'),'Project 5 dashboard: trends, segments and anomalies',run.dashboard);
  if (run.duplicateCandidates.length) details($('#evidence'),'Similar-text records retained for review',run.duplicateCandidates);
  for (const evidence of run.evidence) {
    const card = el('article',undefined,'card'); card.id = `evidence-${evidence.id}`;
    card.append(el('p',evidence.text),el('p',`${evidence.id} · ${evidence.source} · ${evidence.topicId} · ${evidence.sentiment.label} · ${evidence.detection.primaryIntent}`,'muted'));
    details(card,'Inspect sentiment and intent evidence',{sentiment:evidence.sentiment,detection:evidence.detection}); $('#evidence').append(card);
  }
  options($('#opportunity'),run.opportunities); $('#opportunity').onchange();
  $('#assessment-count').textContent = `${assessments.length} assessments prepared`;
  $('#ranking').replaceChildren();
  if (run.ranking) {
    $('#ranking').append(el('p',`Capacity used: ${run.ranking.portfolio.used} / ${run.ranking.portfolio.capacity}`));
    for (const o of run.ranking.ranked) {
      const card = el('article',undefined,'card');
      card.append(el('h3',`${o.rank}. ${o.title}`),el('p',`${run.ranking.portfolio.selected.includes(o.id)?'Selected':'Deferred'} · score ${o.score} · evidence ${o.evidenceIds.join(', ')}`));
      details(card,'Review scores and original evidence',o); $('#ranking').append(card);
    }
  }
  options($('#selected-opportunity'),run.ranking?.ranked.filter(o=>run.ranking.portfolio.selected.includes(o.id)) ?? []);
  $('#experiments').replaceChildren(); $('#learning').replaceChildren();
  for (const experiment of run.experiments) renderExperiment(experiment);
  if (!run.experiments.length) $('#experiments').append(el('p','No experiments yet. Review and rank an opportunity first.'));
  if (!run.experiments.some(e=>e.decision)) $('#learning').append(el('p','Reviewed decisions will link back to their opportunities here.'));
}
function renderExperiment(e) {
  const card = el('article',undefined,'card'); card.append(el('h3',e.plan.hypothesis),el('p',`${e.status} · ${e.plan.mode} · ${e.id}`,'muted'));
  details(card,'Locked plan and evidence lineage',{plan:e.plan,opportunityId:e.opportunityId,evidenceIds:e.evidenceIds,rankingSnapshot:e.opportunitySnapshot});
  if (e.status === 'draft') {
    const start = el('button','Lock plan and start'); start.onclick = () => action(async()=>{await mutate(`experiments/${e.id}/start`,{});notice('Plan locked.');}); card.append(start);
  }
  if (['running','review'].includes(e.status)) {
    const form = el('form'); const label = el('label','Upload complete event snapshot (JSON)'); const file = el('input'); Object.assign(file,{type:'file',accept:'.json',required:true}); label.append(file);form.append(label,el('button','Audit and save readout'));
    form.onsubmit = event => {event.preventDefault();action(async()=>{if(file.files[0].size>2_000_000)throw new Error('Use a file under 2 MB');const input=JSON.parse(await file.files[0].text());await mutate(`experiments/${e.id}/readout`,input);notice('Readout saved. Check audit, sample and observation-window status.');});};card.append(form);
  }
  for(const a of e.audits) details(card,`${a.report.status} · ${a.decisionReady?'Ready for human review':'Not ready for decision'} · ${a.createdAt}`,a);
  const latest=e.audits.at(-1);
  if(e.status==='review'&&latest?.decisionReady){
    const form=el('form'); const fields={reviewer:'Reviewer',rationale:'Decision rationale',statisticalReview:'Analyst review: significance, SRM and stopping rules'};
    for(const [name,title] of Object.entries(fields)){const label=el('label',title);const input=el('textarea');input.name=name;input.required=true;label.append(input);form.append(label);}
    const choiceLabel=el('label','Human decision');const select=el('select');select.name='outcome';for(const v of ['iterate','reject','ship']){const option=el('option',v);option.value=v;if(v==='ship'&&e.plan.mode==='retrospective')option.disabled=true;select.append(option);}choiceLabel.append(select);form.append(choiceLabel);
    for(const [i,g] of e.plan.guardrails.entries()){
      const label=el('label',`${g.name}: ${g.criterion}`);const select=el('select');select.name=`guardrail-${i}`;for(const v of ['failed','passed']){const option=el('option',v);option.value=v;select.append(option);}const evidence=el('textarea');evidence.name=`guardrail-evidence-${i}`;evidence.required=true;evidence.placeholder='Observed result and supporting evidence';label.append(select,evidence);form.append(label);
    }
    form.append(el('button','Record reviewed decision'));
    form.onsubmit=event=>{event.preventDefault();action(async()=>{const input=values(form);input.auditId=latest.id;input.guardrailReviews=e.plan.guardrails.map((g,i)=>({name:g.name,passed:input[`guardrail-${i}`]==='passed',evidence:input[`guardrail-evidence-${i}`]}));await mutate(`experiments/${e.id}/decision`,input);notice('Decision saved against the original opportunity and feedback.');});};card.append(form);
  }
  if(e.decision){details(card,'Recorded decision',e.decision);const item=el('article',undefined,'card');item.append(el('h3',`${e.decision.outcome}: ${e.opportunitySnapshot.title}`),el('p',e.decision.rationale),el('p',`Opportunity ${e.opportunityId} · Evidence ${e.evidenceIds.join(', ')}`));$('#learning').append(item);}
  $('#experiments').append(card);
}
