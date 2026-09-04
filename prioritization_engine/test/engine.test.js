import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOpportunity, normalizeWeights, paretoFront, prioritize, scoreOpportunity, selectPortfolio, simulateOpportunity } from "../public/engine.js";

const strong = { id: "strong", title: "Strong opportunity", businessValue: 9, userValue: 9, strategicAlignment: 9, confidence: .9, feasibility: .9, urgency: 8, effort: 3, risk: .1, uncertainty: .2 };
const weak = { id: "weak", title: "Weak opportunity", businessValue: 3, userValue: 3, strategicAlignment: 2, confidence: .4, feasibility: .5, urgency: 2, effort: 8, risk: .5, uncertainty: .2 };

test("normalizes and bounds an opportunity", () => {
  const result = normalizeOpportunity({ title: "  Useful   idea ", confidence: 2, risk: -1, tags: ["a", "a"] });
  assert.equal(result.title, "Useful idea");
  assert.equal(result.confidence, 1);
  assert.equal(result.risk, 0);
  assert.deepEqual(result.tags, ["a"]);
});

test("rejects invalid title", () => assert.throws(() => normalizeOpportunity({ title: "" }), /non-empty/));

test("normalizes weights to one", () => {
  const weights = normalizeWeights({ businessValue: 1, userValue: 1, strategicAlignment: 0, confidence: 0, feasibility: 0, urgency: 0 });
  assert.equal(weights.businessValue, .5);
  assert.equal(weights.userValue, .5);
  assert.equal(Object.values(weights).reduce((sum, value) => sum + value, 0), 1);
});

test("rejects all-zero weights", () => assert.throws(() => normalizeWeights({ businessValue: 0, userValue: 0, strategicAlignment: 0, confidence: 0, feasibility: 0, urgency: 0 }), /greater than zero/));

test("scores stronger opportunities higher", () => assert.ok(scoreOpportunity(strong).score > scoreOpportunity(weak).score));

test("effort and risk reduce otherwise equal scores", () => {
  const baseline = scoreOpportunity(strong, undefined, 5).score;
  assert.ok(baseline > scoreOpportunity({ ...strong, effort: 20 }, undefined, 5).score);
  assert.ok(baseline > scoreOpportunity({ ...strong, risk: .9 }, undefined, 5).score);
});

test("Monte Carlo simulation is deterministic and ordered", () => {
  const first = simulateOpportunity(strong, { iterations: 500, seed: 7 });
  const second = simulateOpportunity(strong, { iterations: 500, seed: 7 });
  assert.deepEqual(first, second);
  assert.ok(first.p10 <= first.p50 && first.p50 <= first.p90);
});

test("finds non-dominated opportunities", () => {
  const scored = [scoreOpportunity(strong), scoreOpportunity(weak)];
  assert.deepEqual(paretoFront(scored), ["strong"]);
});

test("portfolio includes dependencies before dependent work", () => {
  const ranked = [scoreOpportunity({ ...strong, id: "child", dependencies: ["base"], effort: 3 }), scoreOpportunity({ ...weak, id: "base", effort: 2 })];
  const portfolio = selectPortfolio(ranked, 5);
  assert.deepEqual(portfolio.selected, ["base", "child"]);
  assert.equal(portfolio.used, 5);
});

test("prioritizes, ranks, and reports missing dependencies", () => {
  const result = prioritize([strong, weak, { ...strong, id: "blocked", dependencies: ["missing"] }], { iterations: 100, capacity: 5 });
  assert.equal(result.ranked.length, 3);
  assert.deepEqual(result.ranked.map(item => item.rank), [1, 2, 3]);
  assert.deepEqual(result.ranked.find(item => item.id === "blocked").blockedBy, ["missing"]);
  assert.ok(!result.portfolio.selected.includes("blocked"));
});

test("rejects duplicates and oversized batches", () => {
  assert.throws(() => prioritize([strong, strong]), /duplicate/);
  assert.throws(() => prioritize(Array(501).fill(null).map((_, index) => ({ id: String(index), title: "x" }))), /500/);
});
