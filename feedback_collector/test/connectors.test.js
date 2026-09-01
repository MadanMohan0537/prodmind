import test from "node:test";
import assert from "node:assert/strict";
import { createZendeskConnector, fetchWithRetry, retryAfterMilliseconds } from "../src/connectors.js";

test("Retry-After supports seconds and HTTP dates", () => {
  assert.equal(retryAfterMilliseconds("2", 0), 2_000);
  assert.equal(retryAfterMilliseconds("Thu, 01 Jan 1970 00:00:03 GMT", 1_000), 2_000);
});

test("fetchWithRetry retries a transient response", async () => {
  let calls = 0;
  const response = await fetchWithRetry("https://example.test", {}, {
    retries: 2,
    fetcher: async () => { calls += 1; return new Response("ok", { status: calls === 1 ? 503 : 200 }); },
    sleeper: async () => {}
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("Zendesk connector paginates and maps fetched tickets", async () => {
  const fetcher = async () => Response.json({ end_of_stream: true, tickets: [{ id: 7, description: "Export please", requester_id: 4, created_at: "2026-01-01T00:00:00Z" }] });
  const connector = createZendeskConnector({ subdomain: "demo", token: "token", email: "pm@example.com", fetcher });
  const records = [];
  for await (const record of connector.records()) records.push(record);
  const mapped = records[0];
  assert.equal(mapped.id, "zendesk-7");
  assert.equal(mapped.text, "Export please");
});
