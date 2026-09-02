import { detectFeedbackEvent, detectIntents } from "../public/detector.js";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).includes(origin);
}

function headers(request, env) {
  const origin = request.headers.get("Origin");
  return { ...(origin && allowedOrigin(request, env) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}), "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
}

function json(request, env, body, status = 200) {
  return Response.json(body, { status, headers: headers(request, env) });
}

async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const encoder = new TextEncoder();
  const digests = await Promise.all([provided, env.API_TOKEN].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  return [...new Uint8Array(digests[0])].every((value, index) => value === new Uint8Array(digests[1])[index]);
}

async function persist(input, result, env) {
  const analysisId = crypto.randomUUID();
  if (env.DB) {
    const text = typeof input === "string" ? input : input.text;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const textHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(`INSERT INTO request_analyses
      (id,event_id,text_hash,primary_intent,is_feature_request,request_type,confidence,urgency,impact,intents,needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(analysisId, typeof input === "object" ? input.id || null : null, textHash, result.primaryIntent, result.isFeatureRequest ? 1 : 0, result.requestType, result.confidence, result.urgency.level, result.impact.level, JSON.stringify(result.intents), result.needsReview ? 1 : 0).run();
  }
  return { analysisId, ...result };
}

async function analyze(request, env) {
  let body;
  try { body = await request.json(); } catch { return json(request, env, { error: "Request must contain valid JSON" }, 400); }
  const inputs = Array.isArray(body) ? body : Array.isArray(body.records) ? body.records : [body];
  if (!inputs.length) return json(request, env, { error: "At least one input is required" }, 422);
  if (inputs.length > 500) return json(request, env, { error: "Maximum batch size is 500" }, 413);
  const results = [];
  for (const [index, input] of inputs.entries()) {
    try {
      const result = typeof input === "string" ? detectIntents(input, body.options) : detectFeedbackEvent(input, body.options);
      results.push(await persist(input, result, env));
    } catch (error) { results.push({ index, error: error.message }); }
  }
  return json(request, env, { results, count: results.length, failed: results.filter(result => result.error).length });
}

async function metrics(request, env) {
  if (!env.DB) return json(request, env, { error: "Metrics require D1" }, 503);
  const [intents, summary] = await Promise.all([
    env.DB.prepare("SELECT primary_intent, COUNT(*) count FROM request_analyses GROUP BY primary_intent ORDER BY count DESC").all(),
    env.DB.prepare("SELECT COUNT(*) total, SUM(is_feature_request) feature_requests, SUM(needs_review) needs_review, AVG(confidence) average_confidence FROM request_analyses").first()
  ]);
  return json(request, env, { ...summary, intents: intents.results });
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return allowedOrigin(request, env) ? new Response(null, { headers: headers(request, env) }) : json(request, env, { error: "Origin not allowed" }, 403);
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "feature-request-detector", model: "prodmind-explainable-multilabel-v1", persistence: Boolean(env.DB) });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!allowedOrigin(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
  if (!await authorized(request, env)) return json(request, env, { error: "Unauthorized" }, 401);
  if (url.pathname === "/api/analyze" && request.method === "POST") return analyze(request, env);
  if (url.pathname === "/api/metrics" && request.method === "GET") return metrics(request, env);
  return json(request, env, { error: "Not found" }, 404);
}

export default { fetch: (request, env) => route(request, env).catch(() => json(request, env, { error: "Detection failed", requestId: crypto.randomUUID() }, 500)) };
