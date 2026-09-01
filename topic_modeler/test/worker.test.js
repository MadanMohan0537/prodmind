import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/worker.js";

const env = { API_TOKEN: "secret", ALLOWED_ORIGINS: "https://example.com", ASSETS: { fetch: () => new Response("asset") } };
test("health is public", async () => assert.equal((await route(new Request("https://x/api/health"), env)).status, 200));
test("analysis requires authorization", async () => assert.equal((await route(new Request("https://x/api/topics/analyze", { method: "POST", body: "{}" }), env)).status, 401));
test("authorized analysis returns topics", async () => {
  const request = new Request("https://x/api/topics/analyze", { method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ documents: ["csv export", "export report"] }) });
  const response = await route(request, env); const body = await response.json();
  assert.equal(response.status, 201); assert.equal(body.documentCount, 2);
});
test("CORS only reflects an allowed origin", async () => {
  const request = new Request("https://x/api/health", { headers: { Origin: "https://example.com" } });
  assert.equal((await route(request, env)).headers.get("Access-Control-Allow-Origin"), "https://example.com");
});
