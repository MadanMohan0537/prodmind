import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const env = {
  API_TOKEN: "test-token",
  ASSETS: { fetch: () => new Response("asset") },
};
const request = (path, options = {}) => new Request(`https://example.test${path}`, options);

test("health reports configuration without exposing the secret", async () => {
  const response = await worker.fetch(request("/api/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.configured, true);
  assert.equal(JSON.stringify(body).includes("test-token"), false);
});

test("serves static assets outside the API", async () => {
  const response = await worker.fetch(request("/"), env);
  assert.equal(await response.text(), "asset");
});

test("requires configuration and bearer authentication", async () => {
  const unconfigured = await worker.fetch(request("/api/roadmap-recalibration-recovery"), {});
  const unauthorized = await worker.fetch(request("/api/roadmap-recalibration-recovery"), env);
  assert.equal(unconfigured.status, 503);
  assert.equal(unauthorized.status, 401);
});

test("rejects cross-origin API requests", async () => {
  const response = await worker.fetch(request("/api/roadmap-recalibration-recovery", {
    headers: { Authorization: "Bearer test-token", Origin: "https://attacker.example" },
  }), env);
  assert.equal(response.status, 403);
});

test("rejects unsupported content types and oversized bodies", async () => {
  const unsupported = await worker.fetch(request("/api/roadmap-recalibration-recovery", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "text/plain" },
    body: "{}",
  }), env);
  assert.equal(unsupported.status, 422);
  const oversized = await worker.fetch(request("/api/roadmap-recalibration-recovery", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: "x".repeat(2_000_001),
  }), env);
  assert.equal(oversized.status, 413);
});

