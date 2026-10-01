import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const calibrationReport = {
  schemaVersion: '1.0.0', asOf: '2027-07-02T00:00:00Z', status: 'blocked_acceptance', sourceOutcomeReviewIds: ['outcome-1'],
  checks: [{id: 'effort-bias', passed: false, detail: '0.4; allowed ±0.2'}],
};
const input = {
  asOf: '2027-07-03T00:00:00Z', capacity: 2, minimumCoverageRate: 1,
  candidates: [{id:'policy-1',title:'Trial calibrated ranges',owner:'Product operations',effort:2,covers:['effort-bias'],dependencies:[],policyArea:'estimation',hypothesis:'Reference ranges reduce bias.',changeDescription:'Use reviewed ranges for one cycle.',successMetric:'Bias is at or below 0.2.',guardrail:'Planning lead time does not rise by more than one day.',rollbackPlan:'Restore the previous template.',reversible:true,startsAt:'2027-07-10T00:00:00Z',reviewAt:'2027-08-10T00:00:00Z',minimumObservationDays:30}],
  review: {reviewer:'Operating council',decision:'approve',rationale:'The reversible trial covers the observed gap.',reviewedAt:'2027-07-03T00:00:00Z'},
};
const request = (payload, headers = {}) => new Request('https://example.com/api/planning-policy-experiments', {method:'POST', headers:{Authorization:'Bearer secret','Content-Type':'application/json',...headers}, body:JSON.stringify(payload)});

test('authenticated Worker returns an approved policy experiment plan', async () => {
  const response = await worker.fetch(request({runs:[], calibrationReport, input}), {API_TOKEN:'secret'});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'approved');
});

test('Worker fails closed without configuration or authorization', async () => {
  assert.equal((await worker.fetch(request({}), {})).status, 503);
  const unauthorized = new Request('https://example.com/api/planning-policy-experiments', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
  assert.equal((await worker.fetch(unauthorized, {API_TOKEN:'secret'})).status, 401);
});

test('Worker rejects cross-origin and invalid payloads', async () => {
  assert.equal((await worker.fetch(request({}, {Origin:'https://evil.example'}), {API_TOKEN:'secret'})).status, 403);
  assert.equal((await worker.fetch(request({runs:[],calibrationReport:{},input:{}}), {API_TOKEN:'secret'})).status, 422);
});
