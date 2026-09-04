import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/worker.js";

const env = { API_TOKEN: "secret", ALLOWED_ORIGINS: "https://product.example", ASSETS: { fetch: () => new Response("asset") } };
const request = (path, options = {}) => new Request(`https://worker.example${path}`, options);
const opportunity = { id: "one", title: "Improve onboarding", businessValue: 8, effort: 3 };

test("health is public", async () => {
  const response = await route(request("/api/health"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).service, "prioritization-engine");
});

test("serves assets outside the API", async () => assert.equal(await (await route(request("/"), env)).text(), "asset"));

test("fails closed without authorization", async () => {
  const response = await route(request("/api/prioritize", { method: "POST", body: "{}" }), env);
  assert.equal(response.status, 401);
});

test("rejects unapproved origins", async () => {
  const response = await route(request("/api/prioritize", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer secret", "Content-Type": "application/json" }, body: "{}" }), env);
  assert.equal(response.status, 403);
});

test("prioritizes through the API", async () => {
  const response = await route(request("/api/prioritize", { method: "POST", headers: { Origin: "https://product.example", Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ opportunities: [opportunity], options: { iterations: 100, capacity: 3 } }) }), env);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ranked[0].id, "one");
  assert.deepEqual(result.portfolio.selected, ["one"]);
  assert.equal(result.persisted, false);
});

test("returns a useful invalid JSON response", async () => {
  const response = await route(request("/api/prioritize", { method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: "{" }), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid JSON/);
});

test("requires D1 for run history", async () => {
  const response = await route(request("/api/runs", { headers: { Authorization: "Bearer secret" } }), env);
  assert.equal(response.status, 503);
});

test("returns 404 for unknown routes", async () => {
  const response = await route(request("/api/nope", { headers: { Authorization: "Bearer secret" } }), env);
  assert.equal(response.status, 404);
});
