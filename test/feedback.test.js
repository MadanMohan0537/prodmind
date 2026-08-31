import test from "node:test";
import assert from "node:assert/strict";
import { analyze, deduplicate, normalizeRecord, parseCsv } from "../public/feedback.js";

test("classifies feature requests", () => assert.equal(analyze("Please add dark mode").intent, "feature-request"));
test("classifies negative feedback", () => assert.equal(analyze("The page is slow and broken").sentiment, "negative"));
test("normalizes supported text fields", () => assert.equal(normalizeRecord({ review: "  Useful   app " }).text, "Useful app"));
test("removes equivalent duplicates", () => {
  const records = [normalizeRecord({ text: "Add CSV export!" }), normalizeRecord({ text: "CSV export add" })];
  assert.equal(deduplicate(records).length, 1);
});
test("parses basic CSV", () => assert.equal(parseCsv("text,source\nGreat app,review")[0].source, "review"));
