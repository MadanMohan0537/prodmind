import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("health reports configuration without exposing its secret", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/health"), { API_TOKEN: "secret" });
  const copy = response.clone();
  assert.deepEqual(await response.json(), { service: "prodmind-roadmap-estimate-calibration", configured: true });
  assert.doesNotMatch(await copy.text(), /secret/);
});

test("fails closed without authentication and across origins", async () => {
  const missing = await worker.fetch(new Request("https://example.test/api/roadmap-estimate-calibration", { method: "POST" }), {});
  assert.equal(missing.status, 503);
  const crossOrigin = await worker.fetch(new Request("https://example.test/api/roadmap-estimate-calibration", { method: "POST", headers: { Authorization: "Bearer secret", Origin: "https://evil.test" } }), { API_TOKEN: "secret" });
  assert.equal(crossOrigin.status, 403);
  const unauthorized = await worker.fetch(new Request("https://example.test/api/roadmap-estimate-calibration", { method: "POST", headers: { Authorization: "Bearer wrong" } }), { API_TOKEN: "secret" });
  assert.equal(unauthorized.status, 401);
});

test("returns structured bounded validation errors", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/roadmap-estimate-calibration", {
    method: "POST",
    headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
    body: JSON.stringify({ runs: [], cases: [], input: {} }),
  }), { API_TOKEN: "secret" });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /1–30 delivery cases/);
});
