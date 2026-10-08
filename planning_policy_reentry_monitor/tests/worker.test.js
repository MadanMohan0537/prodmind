import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";
const env = { API_TOKEN: "test-token" };
test("health reports configuration without exposing its secret", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/health"),
    env,
  );
  assert.deepEqual(await response.json(), {
    service: "prodmind-planning-policy-reentry-monitor",
    configured: true,
  });
});
test("fails closed without authentication and across origins", async () => {
  const request = (headers) =>
    new Request("https://example.test/api/planning-policy-reentry-assurance", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: "{}",
    });
  assert.equal((await worker.fetch(request({}), env)).status, 401);
  assert.equal(
    (
      await worker.fetch(
        request({
          Authorization: "Bearer test-token",
          Origin: "https://other.test",
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (await worker.fetch(request({ Authorization: "Bearer test-token" }), {}))
      .status,
    503,
  );
});
test("returns structured bounded validation errors", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/planning-policy-reentry-assurance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ runs: [] }),
    }),
    env,
  );
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /Project 38/);
});
