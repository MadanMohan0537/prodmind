import {buildLearningMemory, searchLearningMemory} from './memory.js';

const reply = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [left,right] = await Promise.all([digest(request.headers.get('Authorization') ?? ''),digest(`Bearer ${env.API_TOKEN}`)]);
  let mismatch=0;for(let index=0;index<left.length;index++)mismatch|=left[index]^right[index];return mismatch===0;
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('Use application/json');
  const reader=request.body?.getReader();if(!reader)throw new Error('Request body required');let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();throw new RangeError('Request exceeds 2 MB');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const parsed=JSON.parse(new TextDecoder().decode(bytes));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('JSON object required');return parsed;
}

export default {async fetch(request, env) {
  const path = new URL(request.url).pathname;
  if (path === '/api/health') return reply({status:'ok', configured:Boolean(env.API_TOKEN)});
  if (!['/api/index','/api/search'].includes(path)) return env.ASSETS ? env.ASSETS.fetch(request) : reply({error:'Not found'},404);
  if (request.method !== 'POST') return reply({error:'Use POST'},405);
  if (!env.API_TOKEN) return reply({error:'Service not configured'},503);
  if (!await authorized(request,env)) return reply({error:'Unauthorized'},401);
  try {
    const input = await body(request); const memory = buildLearningMemory(input.runs);
    return reply(path === '/api/search' ? searchLearningMemory(memory,input.query,input.filters) : memory);
  } catch (error) {return reply({error:error.message},error instanceof RangeError ? 413 : 422);}
}};
