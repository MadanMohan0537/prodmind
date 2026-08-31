import test from "node:test";
import assert from "node:assert/strict";
import { analyze, canonicalize, deduplicate, normalizeRecord, parseCsv, validateEvent, validateInput } from "../public/feedback.js";

test("classifies feature requests with confidence", () => {
  const result = analyze("Please add dark mode");
  assert.equal(result.intent, "feature-request");
  assert.ok(result.confidence > 0.5);
});

test("handles simple negation", () => assert.notEqual(analyze("The page is not slow").sentiment, "negative"));
test("rejects missing text", () => assert.deepEqual(validateInput({ source: "survey" }), ["text is required and must be a non-empty string"]));
test("rejects invalid metadata", () => assert.ok(validateInput({ text: "Hello", metadata: [] }).length));
test("enforces the normalized event contract", () => assert.ok(validateEvent({ schemaVersion: "2.0", fingerprint: "bad" }).length));
test("normalizes supported text fields", () => assert.equal(normalizeRecord({ review: "  Useful   app " }).text, "Useful app"));

test("client and server canonical semantics are order-insensitive", () => {
  assert.equal(canonicalize("Add CSV export!"), canonicalize("CSV export add"));
  const records = [normalizeRecord({ text: "Add CSV export!" }), normalizeRecord({ text: "CSV export add" })];
  assert.equal(deduplicate(records).length, 1);
});

test("parses quoted multiline CSV", () => {
  const result = parseCsv('text,source\n"Great app, but\nneeds export",review');
  assert.equal(result[0].text, "Great app, but\nneeds export");
  assert.equal(result[0].source, "review");
});

test("trims CSV headers so aliased fields still map", () => {
  const result = parseCsv(" text , source \nUseful app,survey");
  assert.equal(result[0].text, "Useful app");
  assert.equal(result[0].source, "survey");
});

test("normalizes createdAt into ISO-8601", () => {
  const record = normalizeRecord({ text: "Useful app", createdAt: "2026-01-01" });
  assert.equal(record.createdAt, "2026-01-01T00:00:00.000Z");
});

test("generates distinct ids for concurrent records", () => {
  const left = normalizeRecord({ text: "First record" });
  const right = normalizeRecord({ text: "Second record" });
  assert.notEqual(left.id, right.id);
  assert.match(left.id, /^feedback-[0-9a-f-]{36}$/i);
});
