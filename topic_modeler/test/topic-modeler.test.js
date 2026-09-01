import test from "node:test";
import assert from "node:assert/strict";
import { cosine, detectDrift, klDivergence, modelTopics, tokenize } from "../public/topic-modeler.js";

test("tokenization normalizes accents and removes stop words", () => assert.deepEqual(tokenize("The rápido dashboard export"), ["rapido", "dashboard", "export"]));
test("cosine similarity distinguishes related vectors", () => { assert.equal(cosine({ export: 1 }, { export: 1 }), 1); assert.equal(cosine({ export: 1 }, { login: 1 }), 0); });
test("KL divergence is zero for identical distributions", () => assert.equal(klDivergence({ a: .5, b: .5 }, { a: .5, b: .5 }), 0));
test("drift reports insufficient data for tiny samples", () => assert.equal(detectDrift([{ text: "one", timestamp: new Date().toISOString() }]).level, "insufficient-data"));
test("model creates assignments, weighted keywords, and hierarchy", () => {
  const result = modelTopics(["csv export reports", "export dashboard reports", "login crash mobile", "mobile login freezes"], { similarityThreshold: .2 });
  assert.equal(result.documentCount, 4); assert.equal(result.assignments.length, 4); assert.ok(result.topicCount >= 2); assert.ok(result.topics[0].keywords.length); assert.ok(result.hierarchy.length);
});
test("model rejects an empty collection", () => assert.throws(() => modelTopics([]), /At least one/));
test("model validates timestamps", () => assert.throws(() => modelTopics([{ text: "valid text", timestamp: "bad" }]), /invalid timestamp/));
