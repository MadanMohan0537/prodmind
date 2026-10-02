const sample = {
  runs: [],
  policyPlan: {schemaVersion:'1.0.0',status:'approved',asOf:'2027-01-01T00:00:00.000Z',sourceOutcomeReviewIds:['outcome-1'],selectedExperiments:[{id:'trial-1',startsAt:'2027-01-02T00:00:00.000Z',reviewAt:'2027-02-01T00:00:00.000Z',minimumObservationDays:30,minimumSampleSize:100,primaryMeasure:{name:'On-time rate',unit:'%',direction:'increase',baseline:70,target:80},guardrailMeasure:{name:'Defect rate',unit:'%',direction:'not_increase',baseline:5,tolerance:1}}]},
  input: {asOf:'2027-02-02T00:00:00Z',reviews:[{id:'review-1',experimentId:'trial-1',completedAt:'2027-02-01T00:00:00Z',sampleSize:120,observedPrimary:82,observedGuardrail:5.5,deliveryEvidence:'Release record',analysisEvidence:'Analysis notebook',review:{reviewer:'Product council',decision:'adopt',rationale:'All declared checks passed.',reviewedAt:'2027-02-02T00:00:00Z'}}]},
};
const payload = document.querySelector('#payload'); const result = document.querySelector('#result'); const status = document.querySelector('#status');
payload.value = JSON.stringify(sample, null, 2);
document.querySelector('#verify').addEventListener('click', async () => {
  status.textContent = 'Verifying…';
  try {
    const response = await fetch('/api/planning-policy-outcomes', {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${document.querySelector('#token').value}`},body:payload.value});
    const body = await response.json(); result.textContent = JSON.stringify(body, null, 2); status.textContent = response.ok ? 'Verification complete.' : `Request rejected (${response.status}).`;
  } catch (error) { status.textContent = error.message; }
});
