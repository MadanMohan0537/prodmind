import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDataset } from "../scripts/evaluate.js";

test("evaluation calculates per-label metrics and mismatches", () => {
  const report = evaluateDataset([{ text: "Please add export", labels: ["feature-request"] }, { text: "The app crashes", labels: ["bug-report"] }]);
  assert.equal(report.records, 2); assert.equal(report.labels["feature-request"].recall, 1); assert.ok(Array.isArray(report.mismatches));
});
