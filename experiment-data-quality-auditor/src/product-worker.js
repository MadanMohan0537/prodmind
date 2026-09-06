import {discover, rankOpportunities} from './pipeline.js';
import {addExperiment, startExperiment, recordReadout, recordDecision, learningLedger} from './lifecycle.js';
import {RunStore, Conflict} from './store.js';
import auditor from './worker.js';

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const json = (value, status = 200) => Response.json(value, {status, headers});

async function body(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new Error('Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body required');
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {await reader.cancel(); throw new RangeError('Request exceeds 2 MB');}
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('JSON object required');
  return parsed;
}

async function authorized(request, token) {
  const provided = request.headers.get('Authorization') ?? '';
  const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([hash(provided), hash(`Bearer ${token}`)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({service: 'prodmind-connected-workflow', configured: Boolean(env.DB && env.API_TOKEN)});
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS) return json({error: 'Static assets unavailable'}, 503);
      const response = await env.ASSETS.fetch(request);
      return new Response(response.body, {status: response.status, headers: {...Object.fromEntries(response.headers), ...headers}});
    }
    if (!env.API_TOKEN) return json({error: 'Set API_TOKEN before using the workspace'}, 503);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({error: 'Cross-origin requests are not allowed'}, 403);
    if (!await authorized(request, env.API_TOKEN)) return json({error: 'Unauthorized'}, 401);
    if (url.pathname === '/api/audit') return auditor.fetch(request, env);
    if (!env.DB) return json({error: 'Persistent D1 storage is required; no ephemeral success is returned'}, 503);
    const store = new RunStore(env.DB);
    try {
      if (url.pathname === '/api/runs' && request.method === 'GET') return json({runs: await store.list()});
      if (url.pathname === '/api/runs' && request.method === 'POST') return json(await store.create(await discover(await body(request))), 201);
      const match = /^\/api\/runs\/([\w-]+)(?:\/(rank|experiments|learning)(?:\/([\w-]+)\/(start|readout|decision))?)?$/.exec(url.pathname);
      if (!match) return json({error: 'Not found'}, 404);
      const [, runId, action, experimentId, transition] = match;
      const run = await store.get(runId);
      if (!run) return json({error: 'Run not found'}, 404);
      if (request.method === 'GET' && !action) return json(run);
      if (request.method === 'GET' && action === 'learning') return json({runId, learning: learningLedger(run)});
      if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
      const input = await body(request);
      if (!Number.isInteger(input.version) || input.version !== run.version) throw new Conflict('Version changed; reload the run');
      let next;
      if (action === 'rank') next = rankOpportunities(run, input);
      else if (action === 'experiments' && !experimentId) next = addExperiment(run, input);
      else if (action === 'experiments' && transition === 'start') next = startExperiment(run, experimentId);
      else if (action === 'experiments' && transition === 'readout') next = recordReadout(run, experimentId, input);
      else if (action === 'experiments' && transition === 'decision') next = recordDecision(run, experimentId, input);
      else return json({error: 'Not found'}, 404);
      return json(await store.save(next, input.version));
    } catch (error) {
      if (error instanceof Conflict) return json({error: error.message}, 409);
      if (/D1_|SQLITE|database|storage/i.test(error.message)) return json({error: 'Storage operation failed; no success was recorded'}, 503);
      return json({error: error.message}, error instanceof RangeError ? 413 : 422);
    }
  },
};
