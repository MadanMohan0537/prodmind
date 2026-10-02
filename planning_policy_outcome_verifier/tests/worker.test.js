import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.js';

test('health does not expose the token', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/health'), {API_TOKEN: 'secret'});
  assert.deepEqual(await response.json(), {service: 'prodmind-planning-policy-outcome-verifier', configured: true});
});

test('rejects unauthenticated and cross-origin requests', async () => {
  const unauthorized = await worker.fetch(new Request('https://example.test/api/planning-policy-outcomes', {method: 'POST'}), {API_TOKEN: 'secret'});
  assert.equal(unauthorized.status, 401);
  const crossOrigin = await worker.fetch(new Request('https://example.test/api/planning-policy-outcomes', {method: 'POST', headers: {Authorization: 'Bearer secret', Origin: 'https://evil.test'}}), {API_TOKEN: 'secret'});
  assert.equal(crossOrigin.status, 403);
});

test('enforces JSON and returns structured validation errors', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/planning-policy-outcomes', {method: 'POST', headers: {Authorization: 'Bearer secret', 'Content-Type': 'application/json'}, body: '{}'}), {API_TOKEN: 'secret'});
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /product runs/);
});

