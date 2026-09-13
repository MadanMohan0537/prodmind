import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const payload={runs:[{id:'r',ranking:{portfolio:{selected:['a']},ranked:[{id:'a',title:'A',effort:1,dependencies:[],evidenceIds:['f']}]}}],strategy:{objectives:[{id:'o',title:'Objective',minShare:1,maxShare:1}],mappings:[{runId:'r',opportunityId:'a',objectiveId:'o'}]},options:{capacity:1,scenarios:[{id:'base'}]}};
const request=(body=payload,token='secret')=>new Request('https://test/api/stress',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('health is public',async()=>{const response=await worker.fetch(new Request('https://test/api/health'),{});assert.equal(response.status,200)});
test('authenticated Worker returns a stress report',async()=>{const response=await worker.fetch(request(),{API_TOKEN:'secret'});assert.equal(response.status,200);assert.equal((await response.json()).status,'resilient')});
test('Worker fails closed without configuration or authorization',async()=>{assert.equal((await worker.fetch(request(),{})).status,503);assert.equal((await worker.fetch(request(payload,'bad'),{API_TOKEN:'secret'})).status,401)});
test('Worker rejects invalid input and content type',async()=>{assert.equal((await worker.fetch(request({...payload,options:{capacity:1,scenarios:[]}}),{API_TOKEN:'secret'})).status,422);const bad=new Request('https://test/api/stress',{method:'POST',headers:{Authorization:'Bearer secret'},body:'{}'});assert.equal((await worker.fetch(bad,{API_TOKEN:'secret'})).status,422)});
