import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.js';

test('health reports configuration without exposing the token',async()=>{const response=await worker.fetch(new Request('https://example.test/api/health'),{API_TOKEN:'secret'});assert.deepEqual(await response.json(),{service:'prodmind-planning-policy-change-controller',configured:true});});
test('fails closed without authorization and across origins',async()=>{assert.equal((await worker.fetch(new Request('https://example.test/api/planning-policy-changes',{method:'POST'}),{API_TOKEN:'secret'})).status,401);assert.equal((await worker.fetch(new Request('https://example.test/api/planning-policy-changes',{method:'POST',headers:{Authorization:'Bearer secret',Origin:'https://evil.test'}}),{API_TOKEN:'secret'})).status,403);});
test('returns bounded structured validation errors',async()=>{const response=await worker.fetch(new Request('https://example.test/api/planning-policy-changes',{method:'POST',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:'{}'}),{API_TOKEN:'secret'});assert.equal(response.status,422);assert.match((await response.json()).error,/product runs/);});

