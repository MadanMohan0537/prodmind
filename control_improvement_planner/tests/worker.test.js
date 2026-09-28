import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const payload = {
  runs: [],
  recurrenceReport: {
    schemaVersion: '1.0.0',
    surveillance: [{
      id: 'surveillance-1', exitReviewId: 'exit-1', governancePackId: 'pack-1',
      portfolioItemId: 'run:opportunity', title: 'Control', evidenceIds: ['feedback-1'],
      recurrenceCount: 1, firstRecurrenceAt: '2027-05-01T00:00:00Z', failedChecks: ['target-stable'],
    }],
  },
  input: {
    asOf: '2027-05-10T00:00:00Z', capacity: 2, minimumCoverageRate: 1,
    candidates: [{
      id: 'action-1', title: 'Prevent recurrence', owner: 'Platform lead', effort: 2,
      covers: ['surveillance-1'], dependencies: [], response: 'prevent',
      dueAt: '2027-06-01T00:00:00Z', successMetric: 'Three passing snapshots.', verificationWindowDays: 30,
    }],
    review: {reviewer: 'Council', decision: 'approve', rationale: 'Complete plan.', reviewedAt: '2027-05-10T00:00:00Z'},
  },
};

const request = (body = payload, token = 'secret', origin) => new Request('https://test.example/api/control-improvements', {
  method: 'POST',
  headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(origin ? {Origin: origin} : {})},
  body: JSON.stringify(body),
});

test('authenticated Worker returns an approved improvement plan', async () => {
  const response = await worker.fetch(request(), {API_TOKEN: 'secret'});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'approved');
});

test('Worker fails closed without configuration or authorization', async () => {
  assert.equal((await worker.fetch(request(), {})).status, 503);
  assert.equal((await worker.fetch(request(payload, 'bad'), {API_TOKEN: 'secret'})).status, 401);
});

test('Worker rejects cross-origin requests and invalid payloads', async () => {
  assert.equal((await worker.fetch(request(payload, 'secret', 'https://other.example'), {API_TOKEN: 'secret'})).status, 403);
  const invalid = structuredClone(payload);
  invalid.input.capacity = -1;
  assert.equal((await worker.fetch(request(invalid), {API_TOKEN: 'secret'})).status, 422);
});

