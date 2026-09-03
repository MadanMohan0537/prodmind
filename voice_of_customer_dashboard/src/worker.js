import { buildDashboard, normalizeEvent } from "../public/analytics.js";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).includes(origin);
}

function responseHeaders(request, env) {
  const origin = request.headers.get("Origin");
  return {
    ...(origin && allowedOrigin(request, env) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  };
}

function json(request, env, body, status = 200) {
  return Response.json(body, { status, headers: responseHeaders(request, env) });
}

async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const encode = value => new TextEncoder().encode(value);
  const [left, right] = await Promise.all([provided, env.API_TOKEN].map(value => crypto.subtle.digest("SHA-256", encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function readBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 2_000_000) throw new RangeError("request body exceeds 2 MB");
  try { return await request.json(); } catch { throw new TypeError("request must contain valid JSON"); }
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function storeEvents(events, env) {
  if (!env.DB) return { persisted: 0, duplicates: 0 };
  let persisted = 0;
  let duplicates = 0;
  for (const event of events) {
    const fingerprint = await hash(`${event.source}|${event.customerId}|${event.timestamp}|${event.text}`);
    const result = await env.DB.prepare(`INSERT OR IGNORE INTO voc_events
      (id,fingerprint,occurred_at,source,segment,customer_id,feedback_text,sentiment,topics,intents,metadata)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(event.id, fingerprint, event.timestamp, event.source, event.segment, event.customerId, event.text, event.sentiment, JSON.stringify(event.topics), JSON.stringify(event.intents), JSON.stringify(event.metadata)).run();
    if (result.meta?.changes) persisted += 1;
    else duplicates += 1;
  }
  return { persisted, duplicates };
}

function filtersFrom(url) {
  return {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    source: url.searchParams.get("source") || undefined,
    segment: url.searchParams.get("segment") || undefined,
    topic: url.searchParams.get("topic") || undefined,
    query: url.searchParams.get("query") || undefined
  };
}

async function ingest(request, env) {
  let body;
  try { body = await readBody(request); } catch (error) { return json(request, env, { error: error.message }, error instanceof RangeError ? 413 : 400); }
  const input = Array.isArray(body) ? body : body.records;
  if (!Array.isArray(input) || !input.length) return json(request, env, { error: "at least one event is required" }, 422);
  if (input.length > 500) return json(request, env, { error: "maximum batch size is 500" }, 413);
  const events = [];
  const errors = [];
  input.forEach((event, index) => {
    try { events.push(normalizeEvent(event, index)); } catch (error) { errors.push({ index, error: error.message }); }
  });
  const storage = await storeEvents(events, env);
  return json(request, env, { accepted: events.length, rejected: errors.length, errors, ...storage }, errors.length ? 207 : 202);
}

async function dashboard(request, env, url) {
  if (!env.DB) return json(request, env, { error: "dashboard history requires D1; use POST /api/dashboard for stateless analysis" }, 503);
  const limit = Math.max(1, Math.min(10_000, Number(url.searchParams.get("limit") || 5_000)));
  const result = await env.DB.prepare(`SELECT id,occurred_at,source,segment,customer_id,feedback_text,sentiment,topics,intents,metadata
    FROM voc_events ORDER BY occurred_at DESC LIMIT ?`).bind(limit).all();
  const events = result.results.map(row => ({ id: row.id, timestamp: row.occurred_at, source: row.source, segment: row.segment, customerId: row.customer_id, text: row.feedback_text, sentiment: row.sentiment, topics: JSON.parse(row.topics), intents: JSON.parse(row.intents), metadata: JSON.parse(row.metadata) }));
  return json(request, env, buildDashboard(events, filtersFrom(url)));
}

async function analyze(request, env) {
  let body;
  try { body = await readBody(request); } catch (error) { return json(request, env, { error: error.message }, error instanceof RangeError ? 413 : 400); }
  const events = Array.isArray(body) ? body : body.records;
  if (!Array.isArray(events) || !events.length) return json(request, env, { error: "at least one event is required" }, 422);
  try { return json(request, env, buildDashboard(events, body.filters || {}, body.options || {})); }
  catch (error) { return json(request, env, { error: error.message }, error instanceof RangeError ? 413 : 422); }
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return allowedOrigin(request, env) ? new Response(null, { headers: responseHeaders(request, env) }) : json(request, env, { error: "origin not allowed" }, 403);
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "voice-of-customer-dashboard", persistence: Boolean(env.DB), schemaVersion: "1.0.0" });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!allowedOrigin(request, env)) return json(request, env, { error: "origin not allowed" }, 403);
  if (!await authorized(request, env)) return json(request, env, { error: "unauthorized" }, 401);
  if (url.pathname === "/api/events" && request.method === "POST") return ingest(request, env);
  if (url.pathname === "/api/dashboard" && request.method === "GET") return dashboard(request, env, url);
  if (url.pathname === "/api/dashboard" && request.method === "POST") return analyze(request, env);
  return json(request, env, { error: "not found" }, 404);
}

export default {
  fetch: (request, env) => route(request, env).catch(() => json(request, env, { error: "request failed", requestId: crypto.randomUUID() }, 500))
};
