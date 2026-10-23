import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

const env = { API_TOKEN: "test-token", ASSETS: { fetch: () => new Response("asset") } };
const request = (path, options = {}) => new Request(`https://example.test${path}`, options);
test("health reports configuration without exposing its secret", async () => { const response = await worker.fetch(request("/api/health"), env); const body = await response.json(); assert.deepEqual(body, { service: "prodmind-roadmap-recalibration-promotion-outcome-monitor", configured: true }); assert.equal(JSON.stringify(body).includes("test-token"), false); });
test("fails closed without configuration or authentication", async () => { const path = "/api/roadmap-recalibration-promotion-outcomes"; assert.equal((await worker.fetch(request(path), {})).status, 503); assert.equal((await worker.fetch(request(path), env)).status, 401); });
test("rejects cross-origin API requests", async () => { const response = await worker.fetch(request("/api/roadmap-recalibration-promotion-outcomes", { headers: { Authorization: "Bearer test-token", Origin: "https://attacker.example" } }), env); assert.equal(response.status, 403); });
test("returns structured validation errors", async () => { const response = await worker.fetch(request("/api/roadmap-recalibration-promotion-outcomes", { method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: "{}" }), env); assert.equal(response.status, 422); assert.match((await response.json()).error, /Project 53/); });
test("serves assets and rejects unsafe request bodies", async () => { assert.equal(await (await worker.fetch(request("/"), env)).text(), "asset"); const path = "/api/roadmap-recalibration-promotion-outcomes", headers = { Authorization: "Bearer test-token" }; assert.equal((await worker.fetch(request(path, { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "{}" }), env)).status, 422); assert.equal((await worker.fetch(request(path, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "x".repeat(2_000_001) }), env)).status, 413); });
