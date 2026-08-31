import { canonicalize, deduplicate, normalizeRecord, validateInput } from "../public/feedback.js";
import { createZendeskConnector } from "./connectors.js";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!origin) return null;
  return allowed.includes(origin) ? origin : null;
}

function responseHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  };
}

function json(request, env, data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { ...responseHeaders(request, env), ...headers } });
}

function tokenFrom(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function equalSecret(provided, expected) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  return crypto.subtle.timingSafeEqual
    ? crypto.subtle.timingSafeEqual(left, right)
    : [...new Uint8Array(left)].every((value, index) => value === new Uint8Array(right)[index]);
}

export async function authorize(request, env) {
  return equalSecret(tokenFrom(request), env.API_TOKEN);
}

export async function enforceRateLimit(request, env, limit = 60) {
  if (!env.DB) return { allowed: true, remaining: limit };
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const bucket = new Date().toISOString().slice(0, 16);
  const key = `${ip}:${bucket}`;
  await env.DB.prepare("INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, datetime('now', '+2 minutes')) ON CONFLICT(key) DO UPDATE SET count = count + 1").bind(key).run();
  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(key).first();
  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count) };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareRecord(record, index = 0) {
  const errors = validateInput(record);
  if (errors.length) return { errors, index };
  const normalized = normalizeRecord(record, index);
  return {
    value: {
      ...normalized,
      schemaVersion: "1.0",
      fingerprint: await sha256(canonicalize(normalized.text))
    }
  };
}

export async function storeBatch(db, records, jobId) {
  if (!db) return { stored: records.length, duplicates: 0, persistence: "ephemeral" };
  let stored = 0;
  let duplicates = 0;
  for (const item of records) {
    const result = await db.prepare(`INSERT OR IGNORE INTO feedback_events
      (id, schema_version, text, source, customer, created_at, sentiment, intent, confidence, classifier, fingerprint, metadata, ingestion_job_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        item.id, item.schemaVersion, item.text, item.source, item.customer, item.createdAt,
        item.sentiment, item.intent, item.confidence, item.classifier, item.fingerprint,
        JSON.stringify(item.metadata), jobId
      ).run();
    result.meta.changes ? stored += 1 : duplicates += 1;
  }
  return { stored, duplicates, persistence: "d1" };
}

export async function processPayload(env, payload) {
  const prepared = await Promise.all(payload.records.map(prepareRecord));
  const invalid = prepared.filter(result => result.errors);
  const unique = deduplicate(prepared.filter(result => result.value).map(result => result.value));
  const result = await storeBatch(env.DB, unique, payload.jobId);
  const duplicates = result.duplicates + prepared.length - invalid.length - unique.length;
  if (env.DB) {
    await env.DB.prepare("UPDATE ingestion_jobs SET status = ?, accepted = ?, duplicates = ?, rejected = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind("completed", result.stored, duplicates, invalid.length, payload.jobId).run();
  }
  return { ...result, duplicates, rejected: invalid.length, validationErrors: invalid };
}

async function handleIngest(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json(request, env, { error: "Request must contain valid JSON" }, 400); }
  const records = Array.isArray(body) ? body : Array.isArray(body.records) ? body.records : [body];
  if (records.length > 1_000) return json(request, env, { error: "Maximum batch size is 1,000" }, 413);
  const jobId = crypto.randomUUID();
  if (env.DB) {
    await env.DB.prepare("INSERT INTO ingestion_jobs (id, source, status, received) VALUES (?, ?, ?, ?)")
      .bind(jobId, body.source || "api", env.INGESTION_QUEUE ? "queued" : "processing", records.length).run();
  }
  const payload = { jobId, records };
  if (env.INGESTION_QUEUE) {
    await env.INGESTION_QUEUE.send(payload);
    return json(request, env, { jobId, status: "queued", received: records.length }, 202);
  }
  return json(request, env, { jobId, status: "completed", received: records.length, ...await processPayload(env, payload) }, 201);
}

async function handleList(request, env, url) {
  if (!env.DB) return json(request, env, { data: [], notice: "D1 is not bound" });
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const source = url.searchParams.get("source");
  const query = source
    ? env.DB.prepare("SELECT * FROM feedback_events WHERE source = ? ORDER BY created_at DESC LIMIT ?").bind(source, limit)
    : env.DB.prepare("SELECT * FROM feedback_events ORDER BY created_at DESC LIMIT ?").bind(limit);
  const result = await query.all();
  return json(request, env, { data: result.results, count: result.results.length });
}

async function handleExport(request, env) {
  if (!env.DB) return json(request, env, { error: "Export requires D1" }, 503);
  const result = await env.DB.prepare("SELECT * FROM feedback_events ORDER BY created_at ASC LIMIT 10000").all();
  const body = result.results.map(row => JSON.stringify({ ...row, metadata: JSON.parse(row.metadata || "{}") })).join("\n");
  return new Response(body, { headers: { ...responseHeaders(request, env), "Content-Type": "application/x-ndjson", "Content-Disposition": "attachment; filename=feedback-events.jsonl" } });
}

export async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (request.headers.get("Origin") && !allowedOrigin(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
    return new Response(null, { headers: responseHeaders(request, env) });
  }
  if (url.pathname === "/api/health") return json(request, env, { status: "ok", service: "feedback-collector", schemaVersion: "1.0", storage: env.DB ? "d1" : "offline" });
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!await authorize(request, env)) return json(request, env, { error: "Unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  const rate = await enforceRateLimit(request, env);
  if (!rate.allowed) return json(request, env, { error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });
  if (url.pathname === "/api/feedback" && request.method === "POST") return handleIngest(request, env);
  if (url.pathname === "/api/feedback" && request.method === "GET") return handleList(request, env, url);
  if (url.pathname === "/api/export" && request.method === "GET") return handleExport(request, env);
  if (url.pathname.startsWith("/api/jobs/") && request.method === "GET") {
    const job = env.DB && await env.DB.prepare("SELECT * FROM ingestion_jobs WHERE id = ?").bind(url.pathname.split("/").pop()).first();
    return job ? json(request, env, job) : json(request, env, { error: "Job not found" }, 404);
  }
  return json(request, env, { error: "Not found" }, 404);
}

async function ingestZendesk(env) {
  if (!env.ZENDESK_SUBDOMAIN || !env.ZENDESK_EMAIL || !env.ZENDESK_TOKEN) return;
  const connector = createZendeskConnector({ subdomain: env.ZENDESK_SUBDOMAIN, email: env.ZENDESK_EMAIL, token: env.ZENDESK_TOKEN });
  const records = [];
  for await (const record of connector.records()) records.push(record);
  if (records.length) await processPayload(env, { jobId: crypto.randomUUID(), records });
}

export default {
  fetch(request, env) {
    return route(request, env).catch(error => json(request, env, { error: "Internal ingestion error", requestId: crypto.randomUUID(), detail: error.message }, 500));
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try { await processPayload(env, message.body); message.ack(); }
      catch (error) { message.attempts < 3 ? message.retry({ delaySeconds: 2 ** message.attempts }) : message.ack(); }
    }
  },
  scheduled(_event, env, context) {
    context.waitUntil(ingestZendesk(env));
  }
};
