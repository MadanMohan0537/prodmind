import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, detectAnomalies, filterEvents, normalizeEvent, parseJsonInput } from "../public/analytics.js";

const records = [
  { id: "1", timestamp: "2026-08-01", source: "support", segment: "SMB", customerId: "a", text: "Setup is confusing", sentiment: -0.8, topics: ["onboarding"], intents: ["complaint"] },
  { id: "2", timestamp: "2026-08-02", source: "survey", segment: "Enterprise", customerId: "b", text: "Reports are great", sentiment: 0.8, topics: ["reporting"], intents: ["praise"] },
  { id: "3", timestamp: "2026-08-02", source: "support", segment: "SMB", customerId: "a", text: "Need a checklist", sentiment: -0.4, topics: ["onboarding"], intents: ["feature-request"] }
];

test("normalizes a compatible event", () => {
  const result = normalizeEvent({ text: "  Useful   feedback ", sentiment: { score: 2 }, topics: "setup, setup" });
  assert.equal(result.text, "Useful feedback");
  assert.equal(result.sentiment, 1);
  assert.deepEqual(result.topics, ["setup"]);
});

test("rejects empty text and invalid dates", () => {
  assert.throws(() => normalizeEvent({ text: "" }), /non-empty/);
  assert.throws(() => normalizeEvent({ text: "ok", timestamp: "bad" }), /valid date/);
});

test("filters across source, segment, topic, query, and date", () => {
  const normalized = records.map(normalizeEvent);
  assert.equal(filterEvents(normalized, { source: "support" }).length, 2);
  assert.equal(filterEvents(normalized, { segment: "Enterprise" }).length, 1);
  assert.equal(filterEvents(normalized, { topic: "onboarding" }).length, 2);
  assert.equal(filterEvents(normalized, { query: "checklist" }).length, 1);
  assert.equal(filterEvents(normalized, { from: "2026-08-02", to: "2026-08-02" }).length, 2);
});

test("builds traceable dashboard aggregates", () => {
  const result = buildDashboard(records);
  assert.equal(result.summary.totalFeedback, 3);
  assert.equal(result.summary.uniqueCustomers, 2);
  assert.equal(result.summary.needsAttention, 2);
  assert.equal(result.topics[0].name, "onboarding");
  assert.equal(result.topics[0].count, 2);
  assert.equal(result.trends.length, 2);
  assert.equal(result.evidence.length, 3);
});

test("does not divide empty metrics by zero", () => {
  const result = buildDashboard([]);
  assert.deepEqual(result.summary, { totalFeedback: 0, uniqueCustomers: 0, averageSentiment: 0, negativeRate: 0, needsAttention: 0 });
});

test("detects volume spikes and sentiment drops", () => {
  const trends = [
    { date: "2026-01-01", volume: 1, averageSentiment: 0.4 },
    { date: "2026-01-02", volume: 1, averageSentiment: 0.5 },
    { date: "2026-01-03", volume: 5, averageSentiment: -0.4 }
  ];
  const anomalies = detectAnomalies(trends, { zThreshold: 2, sentimentDrop: 0.3 });
  assert.deepEqual(new Set(anomalies.map(item => item.type)), new Set(["volume-spike", "sentiment-drop"]));
});

test("parses arrays and records envelopes", () => {
  assert.equal(parseJsonInput('[{"text":"a"}]').length, 1);
  assert.equal(parseJsonInput({ records: [{ text: "b" }] }).length, 1);
  assert.throws(() => parseJsonInput({}), /records array/);
});

test("bounds total analysis size", () => {
  assert.throws(() => buildDashboard(Array(10_001).fill({ text: "x" })), /10,000/);
});
