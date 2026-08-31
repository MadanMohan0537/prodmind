import test from "node:test";
import assert from "node:assert/strict";
import { prepareRecord, route } from "../src/worker.js";

const env = { API_TOKEN: "test-secret", ALLOWED_ORIGINS: "https://app.example.com", ASSETS: { fetch: () => new Response("asset") } };

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
