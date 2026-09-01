import { modelTopics } from "../public/topic-modeler.js";

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
  return Response.json(data, { status, headers: { ...cors(request, env), "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
}

async function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  const provided = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([provided, env.API_TOKEN].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  return [...new Uint8Array(left)].every((value, index) => value === new Uint8Array(right)[index]);
}

async function parseBody(request) {
  const body = await request.json();
  const documents = Array.isArray(body) ? body : body.documents;
  if (!Array.isArray(documents)) throw new Error("documents must be an array");
  if (documents.length > 1000) throw new Error("Maximum batch size is 1,000 documents");
  return { documents, options: body.options || {} };
}

async function persist(result, documents, env) {
  if (!env.DB) return result;
  const runId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO topic_runs (id,document_count,topic_count,drift_score,model) VALUES (?,?,?,?,?)")
    .bind(runId, result.documentCount, result.topicCount, result.drift.score, result.model).run();
  const statements = [];
  for (const topic of result.topics) statements.push(env.DB.prepare("INSERT INTO topics (id,run_id,label,keywords,document_count,share) VALUES (?,?,?,?,?,?)").bind(`${runId}:${topic.id}`, runId, topic.label, JSON.stringify(topic.keywords), topic.documentCount, topic.share));
  for (const assignment of result.assignments) statements.push(env.DB.prepare("INSERT INTO topic_assignments (run_id,document_id,topic_id,similarity) VALUES (?,?,?,?)").bind(runId, assignment.documentId, assignment.topicId, assignment.similarity));
  for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
  return { runId, ...result };
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return originAllowed(request, env) ? new Response(null, { headers: cors(request, env) }) : json(request, env, { error: "Origin not allowed" }, 403);
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "topic-modeler", persistence: Boolean(env.DB) });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!originAllowed(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
  if (!await authorized(request, env)) return json(request, env, { error: "Unauthorized" }, 401);
  if (url.pathname === "/api/runs" && request.method === "GET") {
    if (!env.DB) return json(request, env, { error: "Run history requires D1" }, 503);
    const runs = await env.DB.prepare("SELECT * FROM topic_runs ORDER BY created_at DESC LIMIT 100").all();
    return json(request, env, { runs: runs.results });
  }
  if (url.pathname !== "/api/topics/analyze" || request.method !== "POST") return json(request, env, { error: "Not found" }, 404);
  try {
    const { documents, options } = await parseBody(request);
    return json(request, env, await persist(modelTopics(documents, options), documents, env), 201);
  } catch (error) {
    const status = /Maximum batch/.test(error.message) ? 413 : 422;
    return json(request, env, { error: error.message }, status);
  }
}

export default { fetch: (request, env) => route(request, env).catch(() => json(request, env, { error: "Topic analysis failed" }, 500)) };
