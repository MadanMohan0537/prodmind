import { prioritize } from "../public/engine.js";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).includes(origin);
}

function headers(request, env) {
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
  return Response.json(body, { status, headers: headers(request, env) });
}

async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([provided, env.API_TOKEN].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 2_000_000) throw new RangeError("request body exceeds 2 MB");
  try { return await request.json(); } catch { throw new TypeError("request must contain valid JSON"); }
}

async function runPrioritization(request, env) {
  let body;
  try { body = await readJson(request); } catch (error) { return json(request, env, { error: error.message }, error instanceof RangeError ? 413 : 400); }
  try {
    const opportunities = Array.isArray(body) ? body : body.opportunities;
    const result = prioritize(opportunities, Array.isArray(body) ? {} : body.options || {});
    const runId = crypto.randomUUID();
    if (env.DB) await env.DB.prepare("INSERT INTO prioritization_runs (id,opportunity_count,capacity,weights,result) VALUES (?,?,?,?,?)")
      .bind(runId, result.ranked.length, result.portfolio.capacity, JSON.stringify(result.weights), JSON.stringify(result)).run();
    return json(request, env, { runId, persisted: Boolean(env.DB), ...result });
  } catch (error) {
    return json(request, env, { error: error.message }, error instanceof RangeError ? 413 : 422);
  }
}

async function listRuns(request, env, url) {
  if (!env.DB) return json(request, env, { error: "run history requires D1" }, 503);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
  const rows = await env.DB.prepare("SELECT id,created_at,opportunity_count,capacity,weights FROM prioritization_runs ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json(request, env, { runs: rows.results, count: rows.results.length });
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return allowedOrigin(request, env) ? new Response(null, { headers: headers(request, env) }) : json(request, env, { error: "origin not allowed" }, 403);
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "prioritization-engine", persistence: Boolean(env.DB), schemaVersion: "1.0.0" });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!allowedOrigin(request, env)) return json(request, env, { error: "origin not allowed" }, 403);
  if (!await authorized(request, env)) return json(request, env, { error: "unauthorized" }, 401);
  if (url.pathname === "/api/prioritize" && request.method === "POST") return runPrioritization(request, env);
  if (url.pathname === "/api/runs" && request.method === "GET") return listRuns(request, env, url);
  return json(request, env, { error: "not found" }, 404);
}

export default { fetch: (request, env) => route(request, env).catch(() => json(request, env, { error: "prioritization failed", requestId: crypto.randomUUID() }, 500)) };
