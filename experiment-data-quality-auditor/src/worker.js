import {audit} from './audit.js';

const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'},
});

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return reply({status: 'ok'});
    if (path !== '/api/audit') return reply({error: 'Not found'}, 404);
    if (request.method !== 'POST') return reply({error: 'Use POST'}, 405);
    if (!env.API_TOKEN) return reply({error: 'Service not configured'}, 503);
    if (request.headers.get('Authorization') !== `Bearer ${env.API_TOKEN}`) return reply({error: 'Unauthorized'}, 401);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({error: 'Use application/json'}, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({error: 'Missing body'}, 400);
    let length = 0;
    const chunks = [];
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 2_000_000) {
          await reader.cancel();
          return reply({error: 'Body exceeds 2 MB'}, 413);
        }
        chunks.push(value);
      }
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      return reply(audit(JSON.parse(new TextDecoder().decode(body))));
    } catch {
      return reply({error: 'Invalid JSON or event envelope'}, 422);
    }
  },
};
