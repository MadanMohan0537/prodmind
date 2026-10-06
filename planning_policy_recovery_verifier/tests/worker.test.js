import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.js';

const env={API_TOKEN:'test-token'};
test('health reports configuration without exposing its secret',async()=>{const response=await worker.fetch(new Request('https://example.test/api/health'),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),{service:'prodmind-planning-policy-recovery-verifier',configured:true});});
test('fails closed for unauthenticated and cross-origin requests',async()=>{const request=init=>new Request('https://example.test/api/planning-policy-recovery',{method:'POST',headers:{'Content-Type':'application/json',...init},body:'{}'});assert.equal((await worker.fetch(request({}),env)).status,401);assert.equal((await worker.fetch(request({Authorization:'Bearer test-token',Origin:'https://other.test'}),env)).status,403);assert.equal((await worker.fetch(request({Authorization:'Bearer test-token'}),{})).status,503);});
test('returns bounded structured validation errors',async()=>{const request=new Request('https://example.test/api/planning-policy-recovery',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-token'},body:JSON.stringify({runs:[]})});const response=await worker.fetch(request,env);assert.equal(response.status,422);assert.match((await response.json()).error,/Project 36/);});
