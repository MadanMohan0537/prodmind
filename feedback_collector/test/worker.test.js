import test from "node:test";
import assert from "node:assert/strict";
import worker, { parseLimit, prepareRecord, route, toPublicEvent, markJobFailed } from "../src/worker.js";

const env = { API_TOKEN: "test-secret", ALLOWED_ORIGINS: "https://app.example.com", ASSETS: { fetch: () => new Response("asset") } };

function auth(url, init = {}) {
  return new Request(url, {
    ...init,
    headers: { Authorization: "Bearer test-secret", ...(init.headers || {}) }
  });
}

test("health endpoint is public", async () => {
  const response = await route(new Request("https://worker.test/api/health"), env);
  assert.equal(response.status, 200);
});

test("feedback export rejects unauthenticated requests", async () => {
  const response = await route(new Request("https://worker.test/api/export"), env);
  assert.equal(response.status, 401);
});

test("ingestion rejects an invalid origin preflight", async () => {
  const request = new Request("https://worker.test/api/feedback", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  const response = await route(request, env);
  assert.equal(response.status, 403);
});

test("authenticated ingestion validates and processes a record", async () => {
  const request = new Request("https://worker.test/api/feedback", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Please add export", source: "test" })
  });
  const response = await route(request, env);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.stored, 1);
});

test("prepared fingerprints share canonical dedup semantics", async () => {
  const left = await prepareRecord({ text: "Add CSV export" });
  const right = await prepareRecord({ text: "CSV export add" });
  assert.equal(left.value.fingerprint, right.value.fingerprint);
});

test("ingestion rejects a null JSON body", async () => {
  const response = await route(auth("https://worker.test/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null"
  }), env);
  assert.equal(response.status, 400);
});

test("list clamps negative and non-numeric limits", async () => {
  const bound = [];
  const envWithDb = {
    ...env,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            if (sql.includes("FROM feedback_events")) bound.push(args.at(-1));
            return this;
          },
          async run() { return { meta: { changes: 1 } }; },
          async first() { return { count: 1 }; },
          async all() { return { results: [] }; }
        };
      }
    }
  };
  await route(auth("https://worker.test/api/feedback?limit=-1"), envWithDb);
  await route(auth("https://worker.test/api/feedback?limit=abc"), envWithDb);
  await route(auth("https://worker.test/api/feedback?limit=9000"), envWithDb);
  assert.deepEqual(bound, [100, 100, 500]);
});

test("list and export map D1 rows onto the public event contract", async () => {
  const row = {
    id: "feedback-1",
    schema_version: "1.0",
    text: "Please add export",
    source: "Support",
    customer: "Acme",
    created_at: "2026-01-01T00:00:00.000Z",
    sentiment: "neutral",
    intent: "feature-request",
    confidence: 0.75,
    classifier: "rules-en-v2",
    fingerprint: "a".repeat(64),
    metadata: "{\"connector\":\"zendesk\"}",
    ingestion_job_id: "job-1",
    inserted_at: "2026-01-01T00:00:01.000Z"
  };
  const event = toPublicEvent(row);
  assert.equal(event.schemaVersion, "1.0");
  assert.equal(event.createdAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(event.metadata, { connector: "zendesk" });
  assert.equal(event.ingestion_job_id, undefined);
  assert.equal(event.inserted_at, undefined);

  const envWithDb = {
    ...env,
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async run() { return { meta: { changes: 1 } }; },
          async first() { return { count: 1 }; },
          async all() { return { results: [row] }; }
        };
      }
    }
  };
  const list = await (await route(auth("https://worker.test/api/feedback"), envWithDb)).json();
  assert.equal(list.data[0].schemaVersion, "1.0");
  assert.equal(list.data[0].createdAt, "2026-01-01T00:00:00.000Z");

  const exportResponse = await route(auth("https://worker.test/api/export"), envWithDb);
  const exported = JSON.parse(await exportResponse.text());
  assert.equal(exported.schemaVersion, "1.0");
  assert.equal(exported.ingestion_job_id, undefined);
});

test("export survives malformed metadata", () => {
  const event = toPublicEvent({ metadata: "{not-json", text: "x", schema_version: "1.0" });
  assert.deepEqual(event.metadata, {});
});

test("parseLimit rejects values that would disable SQL LIMIT", () => {
  assert.equal(parseLimit("-1"), 100);
  assert.equal(parseLimit("0"), 100);
  assert.equal(parseLimit("NaN"), 100);
  assert.equal(parseLimit("250"), 250);
});

test("unhandled errors do not leak exception details", async () => {
  const response = await worker.fetch(new Request("https://worker.test/page"), {});
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.detail, undefined);
  assert.equal(body.error, "Internal ingestion error");
  assert.ok(body.requestId);
});

test("queue consumer records a terminal job failure", async () => {
  const updates = [];
  const failingEnv = {
    ...env,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            updates.push({ sql, args });
            if (sql.includes("INSERT OR IGNORE")) throw new Error("d1 unavailable");
            return this;
          },
          async run() { return { meta: { changes: 0 } }; }
        };
      }
    }
  };
  const message = {
    body: { jobId: "job-1", records: [{ text: "Please add export" }] },
    attempts: 3,
    acked: false,
    retried: false,
    ack() { this.acked = true; },
    retry() { this.retried = true; }
  };
  await worker.queue({ messages: [message] }, failingEnv);
  assert.equal(message.acked, true);
  assert.equal(message.retried, false);
  assert.ok(updates.some(entry => entry.sql.includes("status = ?") && entry.args[0] === "failed"));
});

test("markJobFailed is a no-op without a database", async () => {
  await markJobFailed({}, "job-1", new Error("boom"));
});
