import { analyzeFeedbackEvent, analyzeSentiment } from "../public/analyzer.js";

function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).includes(origin);
}

function json(request, env, data, status = 200) {
  return Response.json(data, { status, headers: { ...cors(request, env), "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
}

async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(token)), crypto.subtle.digest("SHA-256", encoder.encode(env.API_TOKEN))]);
  return [...new Uint8Array(a)].every((value, index) => value === new Uint8Array(b)[index]);
}

async function optionalAiReview(text, result, env) {
  if (!env.AI || !result.needsReview) return result;
  try {
    const response = await env.AI.run("@cf/meta/llama-3.2-1b-instruct", {
      messages: [{ role: "system", content: "Classify product feedback as positive, neutral, or negative. Return JSON with label and a short reason." }, { role: "user", content: text }],
      response_format: { type: "json_object" },
      max_tokens: 100
    });
    const reviewed = typeof response.response === "string" ? JSON.parse(response.response) : response;
    return { ...result, aiReview: reviewed, model: `${result.model}+workers-ai-review` };
  } catch {
    return { ...result, aiReview: null, reviewUnavailable: true };
  }
}

async function hashText(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function persistAnalysis(input, result, env) {
  const analysisId = crypto.randomUUID();
  if (env.DB && !result.error) {
    await env.DB.prepare(`INSERT INTO sentiment_analyses
      (id,event_id,text_hash,label,score,confidence,language,model,evidence,aspects,needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
        analysisId, typeof input === "object" ? input.id || null : null,
        await hashText(typeof input === "string" ? input : input.text), result.label, result.score,
        result.confidence, result.language, result.model, JSON.stringify(result.evidence),
        JSON.stringify(result.aspects), result.needsReview ? 1 : 0
      ).run();
  }
  return { analysisId, ...result };
}

async function handleCorrection(request, env) {
  if (!env.DB) return json(request, env, { error: "Corrections require D1" }, 503);
  let body;
  try { body = await request.json(); } catch { return json(request, env, { error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !body.analysisId || !["positive", "neutral", "negative"].includes(body.correctedLabel)) return json(request, env, { error: "analysisId and a valid correctedLabel are required" }, 422);
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 2_000)) return json(request, env, { error: "note must be a string of at most 2,000 characters" }, 422);
  const analysis = await env.DB.prepare("SELECT id FROM sentiment_analyses WHERE id = ?").bind(body.analysisId).first();
  if (!analysis) return json(request, env, { error: "Analysis not found" }, 404);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sentiment_corrections (id,analysis_id,corrected_label,note) VALUES (?,?,?,?)").bind(id, body.analysisId, body.correctedLabel, body.note || null).run();
  return json(request, env, { id, status: "recorded" }, 201);
}

async function handleMetrics(request, env) {
  if (!env.DB) return json(request, env, { error: "Metrics require D1" }, 503);
  const [labels, languages, review, corrections] = await Promise.all([
    env.DB.prepare("SELECT label,COUNT(*) count FROM sentiment_analyses GROUP BY label").all(),
    env.DB.prepare("SELECT language,COUNT(*) count FROM sentiment_analyses GROUP BY language").all(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(needs_review) needs_review,AVG(confidence) average_confidence FROM sentiment_analyses").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM sentiment_corrections").first()
  ]);
  return json(request, env, { labels: labels.results, languages: languages.results, ...review, corrections: corrections.count });
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return originAllowed(request, env) ? new Response(null, { headers: cors(request, env) }) : json(request, env, { error: "Origin not allowed" }, 403);
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "sentiment-analyzer", languages: ["en", "es"], aiReview: Boolean(env.AI) });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!originAllowed(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
  if (!await authorized(request, env)) return json(request, env, { error: "Unauthorized" }, 401);
  if (url.pathname === "/api/corrections" && request.method === "POST") return handleCorrection(request, env);
  if (url.pathname === "/api/metrics" && request.method === "GET") return handleMetrics(request, env);
  if (url.pathname !== "/api/analyze" || request.method !== "POST") return json(request, env, { error: "Not found" }, 404);
  let body;
  try { body = await request.json(); } catch { return json(request, env, { error: "Invalid JSON" }, 400); }
  const inputs = Array.isArray(body) ? body : Array.isArray(body.records) ? body.records : [body];
  if (!inputs.length) return json(request, env, { error: "At least one input is required" }, 422);
  if (inputs.length > 500) return json(request, env, { error: "Maximum batch size is 500" }, 413);
  const results = [];
  for (const [index, input] of inputs.entries()) {
    try {
      const base = typeof input === "string" ? analyzeSentiment(input) : analyzeFeedbackEvent(input);
      const reviewed = await optionalAiReview(typeof input === "string" ? input : input.text, base, env);
      results.push(await persistAnalysis(input, reviewed, env));
    } catch (error) { results.push({ index, error: error.message }); }
  }
  return json(request, env, { results, count: results.length });
}

export default { fetch: (request, env) => route(request, env).catch(() => json(request, env, { error: "Analysis failed", requestId: crypto.randomUUID() }, 500)) };
