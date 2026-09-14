import test from 'node:test';import assert from 'node:assert/strict';import worker from '../src/worker.js';
const payload={runs:[{id:'r',ranking:{portfolio:{selected:['a']},ranked:[{id:'a',title:'Activation',evidenceIds:['f']}]}}],options:{asOf:'2026-02-01',benefits:[{id:'b',portfolioItemId:'r:a',name:'Activation',unit:'%',direction:'increase',baseline:40,target:50,actual:50,baselineAt:'2026-01-01',targetAt:'2026-03-01',measuredAt:'2026-02-01',owner:'PM',attributionNote:'Reviewed with experiment evidence.'}]}};
const req=(body=payload,token='secret')=>new Request('https://test/api/benefits',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('health is public',async()=>assert.equal((await worker.fetch(new Request('https://test/api/health'),{})).status,200));
test('authenticated Worker returns the ledger',async()=>{const response=await worker.fetch(req(),{API_TOKEN:'secret'});assert.equal(response.status,200);assert.equal((await response.json()).summary.realized,1)});
test('Worker fails closed',async()=>{assert.equal((await worker.fetch(req(),{})).status,503);assert.equal((await worker.fetch(req(payload,'bad'),{API_TOKEN:'secret'})).status,401)});
test('Worker rejects invalid data',async()=>assert.equal((await worker.fetch(req({...payload,options:{benefits:[]}}),{API_TOKEN:'secret'})).status,422));
