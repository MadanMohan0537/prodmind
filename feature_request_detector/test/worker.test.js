import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/worker.js";

const env = { API_TOKEN: "secret", ALLOWED_ORIGINS: "https://app.example", ASSETS: { fetch: () => new Response("asset") } };
test("health is public", async () => assert.equal((await route(new Request("https://x/api/health"), env)).status, 200));
test("analysis requires authorization", async () => assert.equal((await route(new Request("https://x/api/analyze", { method: "POST", body: "{}" }), env)).status, 401));
test("authorized batches return multi-intent results", async () => {
  const request = new Request("https://x/api/analyze", { method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ id: "1", text: "Great app, but please add export" }] }) });
  const response = await route(request, env); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.count, 1); assert.ok(body.results[0].intents.length >= 2);
});
test("rejects disallowed origins", async () => {
  const request = new Request("https://x/api/analyze", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ text: "Please add export" }) });
  assert.equal((await route(request, env)).status, 403);
});
test("rejects empty batches", async () => {
  const request = new Request("https://x/api/analyze", { method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: "[]" });
  assert.equal((await route(request, env)).status, 422);
});
test("metrics clearly require D1", async () => {
  const request = new Request("https://x/api/metrics", { headers: { Authorization: "Bearer secret" } });
  assert.equal((await route(request, env)).status, 503);
});
