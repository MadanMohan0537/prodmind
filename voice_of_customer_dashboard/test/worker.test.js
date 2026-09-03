import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/worker.js";

const env = { API_TOKEN: "secret", ALLOWED_ORIGINS: "https://dashboard.example", ASSETS: { fetch: () => new Response("asset") } };
const request = (path, options = {}) => new Request(`https://worker.example${path}`, options);

test("health is public and reports stateless mode", async () => {
  const response = await route(request("/api/health"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).persistence, false);
});

test("serves static assets outside the API", async () => {
  const response = await route(request("/"), env);
  assert.equal(await response.text(), "asset");
});

test("protects API routes", async () => {
  const response = await route(request("/api/dashboard", { method: "POST", body: "{}" }), env);
  assert.equal(response.status, 401);
});

test("rejects unapproved origins", async () => {
  const response = await route(request("/api/dashboard", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer secret", "Content-Type": "application/json" }, body: "{}" }), env);
  assert.equal(response.status, 403);
});

test("builds a dashboard through the stateless API", async () => {
  const response = await route(request("/api/dashboard", { method: "POST", headers: { Origin: "https://dashboard.example", Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ text: "Great", source: "survey", sentiment: 0.8 }] }) }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).summary.totalFeedback, 1);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://dashboard.example");
});

test("requires D1 for persisted dashboard history", async () => {
  const response = await route(request("/api/dashboard", { headers: { Authorization: "Bearer secret" } }), env);
  assert.equal(response.status, 503);
});

test("returns useful errors for invalid requests", async () => {
  const response = await route(request("/api/dashboard", { method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: "{" }), env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid JSON/);
});

test("returns 404 for unknown API routes", async () => {
  const response = await route(request("/api/nope", { headers: { Authorization: "Bearer secret" } }), env);
  assert.equal(response.status, 404);
});
