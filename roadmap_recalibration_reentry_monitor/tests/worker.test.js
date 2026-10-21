import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

const env = {
  API_TOKEN: "test-token",
  ASSETS: { fetch: () => new Response("asset") },
};

function request(path, options = {}) {
  return new Request(`https://example.test${path}`, options);
}

test("health reports configuration without exposing its secret", async () => {
  const response = await worker.fetch(request("/api/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    service: "prodmind-roadmap-recalibration-reentry-monitor",
    configured: true,
  });
  assert.equal(JSON.stringify(body).includes("test-token"), false);
});

test("fails closed without configuration or authentication", async () => {
  const path = "/api/roadmap-recalibration-reentry-assurance";
  assert.equal((await worker.fetch(request(path), {})).status, 503);
  assert.equal((await worker.fetch(request(path), env)).status, 401);
});

test("rejects cross-origin API requests", async () => {
  const response = await worker.fetch(request(
    "/api/roadmap-recalibration-reentry-assurance",
    {
      headers: {
        Authorization: "Bearer test-token",
        Origin: "https://attacker.example",
      },
    },
  ), env);
  assert.equal(response.status, 403);
});

test("returns structured bounded validation errors", async () => {
  const response = await worker.fetch(request(
    "/api/roadmap-recalibration-reentry-assurance",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  ), env);
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Project 51/);
});

test("serves assets and rejects unsafe request bodies", async () => {
  assert.equal(await (await worker.fetch(request("/"), env)).text(), "asset");
  const path = "/api/roadmap-recalibration-reentry-assurance";
  const headers = { Authorization: "Bearer test-token" };
  const unsupported = await worker.fetch(request(path, {
    method: "POST",
    headers: { ...headers, "Content-Type": "text/plain" },
    body: "{}",
  }), env);
  assert.equal(unsupported.status, 422);

  const oversized = await worker.fetch(request(path, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "x".repeat(2_000_001),
  }), env);
  assert.equal(oversized.status, 413);
});
