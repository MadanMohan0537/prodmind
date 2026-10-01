const $ = selector => document.querySelector(selector);

const example = {
  runs: [],
  calibrationReport: {
    schemaVersion: '1.0.0', asOf: '2027-07-02T00:00:00Z', status: 'blocked_acceptance',
    sourceOutcomeReviewIds: ['outcome-1'],
    checks: [
      {id: 'effort-bias', passed: false, detail: '0.4; allowed ±0.2'},
      {id: 'on-time-delivery', passed: false, detail: '0.5; minimum 0.8'},
      {id: 'evidence-coverage', passed: true, detail: '1'},
    ],
  },
  input: {
    asOf: '2027-07-03T00:00:00Z', capacity: 4, minimumCoverageRate: 1,
    candidates: [
      {id:'policy-1',title:'Trial calibrated effort ranges',owner:'Product operations lead',effort:2,covers:['effort-bias'],dependencies:[],policyArea:'estimation',hypothesis:'Reference-class ranges reduce effort bias.',changeDescription:'Use reviewed effort ranges for one planning cycle.',successMetric:'Absolute effort bias is at or below 0.2.',guardrail:'Planning lead time rises by no more than one day.',rollbackPlan:'Restore the previous estimation template.',reversible:true,startsAt:'2027-07-10T00:00:00Z',reviewAt:'2027-08-10T00:00:00Z',minimumObservationDays:30},
      {id:'policy-2',title:'Trial delivery-risk review',owner:'Delivery operations lead',effort:2,covers:['on-time-delivery'],dependencies:[],policyArea:'delivery',hypothesis:'Explicit delivery-risk review improves on-time delivery.',changeDescription:'Add a risk review before commitment for one planning cycle.',successMetric:'On-time delivery is at or above 0.8.',guardrail:'Commitment lead time rises by no more than one day.',rollbackPlan:'Remove the trial review step.',reversible:true,startsAt:'2027-07-10T00:00:00Z',reviewAt:'2027-08-10T00:00:00Z',minimumObservationDays:30},
    ],
    review: {reviewer:'Product operating council',decision:'approve',rationale:'Both reversible trials fit capacity and cover the observed gaps.',reviewedAt:'2027-07-03T00:00:00Z'},
  },
};

function load() { $('#payload').value = JSON.stringify(example, null, 2); }

function render(data) {
  const metrics = [['Gaps',data.summary.calibrationGaps],['Candidates',data.summary.candidates],['Selected',data.summary.selected],['Coverage',`${Math.round(data.summary.coverageRate*100)}%`],['Capacity',`${data.usedCapacity}/${data.capacity}`]];
  $('#result').innerHTML = `<div class="summary">${metrics.map(([label,value])=>`<div class="metric"><span>${label}</span><b>${value}</b></div>`).join('')}</div><article class="card"><p class="eyebrow">${data.status.replaceAll('_',' ')}</p><h2>Human decision: ${data.review.decision}</h2><p>${data.method}</p><ul>${data.selectedExperiments.map(item=>`<li class="pass"><strong>${item.title}</strong> — ${item.policyArea}, owner ${item.owner}, review ${item.reviewAt.slice(0,10)}</li>`).join('')||'<li>No policy experiment selected.</li>'}</ul>${data.uncoveredTargets.length?`<p class="fail">Uncovered: ${data.uncoveredTargets.map(item=>item.id).join(', ')}</p>`:''}</article>`;
}

$('#sample').onclick = load;
$('#run').onclick = async () => {
  try {
    $('#message').textContent = 'Optimizing…';
    const response = await fetch('/api/planning-policy-experiments', {method:'POST',headers:{Authorization:`Bearer ${$('#token').value}`,'Content-Type':'application/json'},body:$('#payload').value});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    render(data);
    $('#message').textContent = 'Plan complete. No planning policy was changed automatically.';
  } catch (error) {
    $('#message').textContent = error.message;
  }
};

load();
