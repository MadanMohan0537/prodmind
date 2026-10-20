import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

const env = {
  API_TOKEN: "test-token",
  ASSETS: { fetch: () => new Response("asset") },
};

test("health reports configuration without exposing its secret", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/health"),
    env,
  );
  assert.deepEqual(await response.json(), {
    service: "prodmind-roadmap-recalibration-incident-reentry-controller",
    configured: true,
  });
});

test("fails closed without authentication and across origins", async () => {
  const request = (headers) => new Request(
    "https://example.test/api/roadmap-recalibration-reentry",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: "{}",
    },
  );

  assert.equal((await worker.fetch(request({}), env)).status, 401);
  assert.equal((await worker.fetch(request({
    Authorization: "Bearer test-token",
    Origin: "https://other.test",
  }), env)).status, 403);
  assert.equal((await worker.fetch(request({
    Authorization: "Bearer test-token",
  }), {})).status, 503);
});

test("returns structured bounded validation errors", async () => {
  const response = await worker.fetch(new Request(
    "https://example.test/api/roadmap-recalibration-reentry",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({}),
    },
  ), env);

  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Project 50/);
});

test("serves static assets outside the API", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(await response.text(), "asset");
});

test("rejects unsupported content types and oversized bodies", async () => {
  const headers = { Authorization: "Bearer test-token" };
  const unsupported = await worker.fetch(new Request(
    "https://example.test/api/roadmap-recalibration-reentry",
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "text/plain" },
      body: "{}",
    },
  ), env);
  assert.equal(unsupported.status, 422);

  const oversized = await worker.fetch(new Request(
    "https://example.test/api/roadmap-recalibration-reentry",
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "x".repeat(2_000_001),
    },
  ), env);
  assert.equal(oversized.status, 413);
});
