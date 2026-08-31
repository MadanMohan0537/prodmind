import test from"node:test";import assert from"node:assert/strict";import{route}from"../src/worker.js";
const env={API_TOKEN:"secret",ALLOWED_ORIGINS:"https://app.example",ASSETS:{fetch:()=>new Response("asset")}};
test("health is public",async()=>assert.equal((await route(new Request("https://x/api/health"),env)).status,200));
test("analysis requires authentication",async()=>assert.equal((await route(new Request("https://x/api/analyze",{method:"POST",body:"{}"}),env)).status,401));
test("analyzes authenticated batches",async()=>{const r=await route(new Request("https://x/api/analyze",{method:"POST",headers:{Authorization:"Bearer secret","Content-Type":"application/json"},body:JSON.stringify({records:[{id:"1",text:"Great app"},{id:"2",text:"Slow page"}]})}),env);const b=await r.json();assert.equal(r.status,200);assert.equal(b.count,2)});
