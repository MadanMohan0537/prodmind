import test from "node:test";
import assert from "node:assert/strict";
import { detectFeedbackEvent, detectIntents, normalizeText, splitSentences } from "../public/detector.js";

test("normalizes whitespace", () => assert.equal(normalizeText("  add   export "), "add export"));
test("splits feedback into evidence sentences", () => assert.equal(splitSentences("Great app. Add export!").length, 2));
test("detects an explicit feature request", () => { const result = detectIntents("Please add CSV export"); assert.equal(result.isFeatureRequest, true); assert.equal(result.requestType, "explicit"); });
test("detects an implicit unmet need", () => { const result = detectIntents("I wish there was a way to schedule reports"); assert.equal(result.isFeatureRequest, true); assert.equal(result.requestType, "implicit"); });
test("separates a bug from a request", () => { const result = detectIntents("The app crashes during login"); assert.equal(result.primaryIntent, "bug-report"); assert.equal(result.isFeatureRequest, false); });
test("returns multiple intents", () => { const labels = detectIntents("I love the app, but please add export because the current workflow is frustrating").intents.map(item => item.label); assert.ok(labels.includes("praise")); assert.ok(labels.includes("feature-request")); assert.ok(labels.includes("complaint")); });
test("detects urgency and broad impact", () => { const result = detectIntents("Urgent blocker for our entire team. Please add SSO."); assert.equal(result.urgency.level, "high"); assert.equal(result.impact.level, "high"); });
test("marks unclear feedback for review", () => assert.equal(detectIntents("The screen contains a menu").needsReview, true));
test("preserves Feedback Collector identity", () => assert.equal(detectFeedbackEvent({ id: "f-1", source: "survey", text: "Please add export" }).eventId, "f-1"));
test("rejects empty input", () => assert.throws(() => detectIntents(" "), /non-empty/));
test("validates thresholds", () => assert.throws(() => detectIntents("Valid text", { threshold: 1 }), /threshold/));
test("detects conditional requests and request-shaped questions", () => {
  const conditional = detectIntents("We will cancel unless you add SAML").intents.map(item => item.label);
  const question = detectIntents("Can you fix the crash and add offline mode?").intents.map(item => item.label);
  assert.ok(conditional.includes("feature-request")); assert.ok(question.includes("question"));
});
