import test from "node:test";
import assert from "node:assert/strict";
import { detect, luhn, pseudonym, scanEvidence, decideGate, DEFAULT_POLICY } from "../src/privacyGate.js";

test("detect: emails, phones, IPs and secrets with positions", () => {
  const text = "Reach me at jane.doe@example.com or +1 (415) 555-0134 from 10.0.0.12, token=abcd1234efgh5678";
  const types = detect(text).map((f) => f.type);
  assert.deepEqual(types, ["email", "phone", "ipv4", "secret"]);
  const email = detect(text)[0];
  assert.equal(text.slice(email.start, email.end), "jane.doe@example.com");
});

test("detect: card numbers require a valid Luhn checksum; SSNs follow the issuing rules", () => {
  assert.equal(luhn("4111111111111111"), true);
  assert.equal(luhn("4111111111111112"), false);
  assert.deepEqual(detect("card 4111 1111 1111 1111 please").map((f) => f.type), ["card_number"]);
  assert.deepEqual(detect("ref 4111 1111 1111 1112").map((f) => f.type), []); // looks like a card, fails Luhn
  assert.deepEqual(detect("order 1234567890123 shipped").map((f) => f.type), []); // 13 digits, invalid Luhn
  assert.deepEqual(detect("ssn 123-45-6789").map((f) => f.type), ["ssn"]);
  assert.deepEqual(detect("not an ssn 000-45-6789 or 666-12-3456").map((f) => f.type), []);
});

test("detect: IBAN checksum and no overlap between detectors", () => {
  assert.deepEqual(detect("pay GB82 WEST 1234 5698 7654 32 today").map((f) => f.type), ["iban"]);
  assert.deepEqual(detect("pay GB82 WEST 1234 5698 7654 33 today").map((f) => f.type), []);
  // A card number must not also be reported as a phone number.
  assert.deepEqual(detect("4111111111111111").map((f) => f.type), ["card_number"]);
});

test("pseudonym: stable, salted, normalizes spacing and case", () => {
  assert.equal(pseudonym("Jane.Doe@Example.com"), pseudonym("jane.doe@example.com"));
  assert.equal(pseudonym("4111 1111 1111 1111"), pseudonym("4111-1111-1111-1111"));
  assert.notEqual(pseudonym("a@b.co", "salt-1"), pseudonym("a@b.co", "salt-2"));
  assert.match(pseudonym("x"), /^[0-9a-f]{8}$/);
});

test("scanEvidence: statuses, redaction, summary and gate status", () => {
  const scan = scanEvidence([
    { feedbackId: "f1", text: "The export button is hard to find." },
    { feedbackId: "f2", text: "Email me at a.user@mail.com about the invoice bug." },
    { feedbackId: "f3", text: "My card 4111 1111 1111 1111 was charged twice." },
    { feedbackId: "f2", text: "duplicate id" },
    { feedbackId: "", text: "no id" },
  ]);
  assert.deepEqual(scan.records.map((r) => r.status), ["clean", "redacted", "blocked", "malformed", "malformed"]);
  assert.equal(scan.records[1].redactedText, "Email me at [EMAIL#" + pseudonym("a.user@mail.com") + "] about the invoice bug.");
  assert.ok(!JSON.stringify(scan).includes("4111 1111"));
  assert.ok(!JSON.stringify(scan).includes("a.user@mail.com"));
  assert.deepEqual(scan.summary, { total: 5, clean: 1, redacted: 1, blocked: 1, malformed: 2, byType: { email: 1, card_number: 1 } });
  assert.equal(scan.gateStatus, "decision_required");
  assert.equal(scan.decisionRequired, true);
  assert.deepEqual(scan.records[3].reasons, ["duplicate_feedback_id"]);
});

test("scanEvidence: clean batches admit, empty or all-malformed batches reject", () => {
  assert.equal(scanEvidence([{ feedbackId: "a", text: "fine" }]).gateStatus, "admit");
  assert.equal(scanEvidence([]).gateStatus, "reject");
  assert.equal(scanEvidence([{ feedbackId: "a", text: 42 }]).gateStatus, "reject");
  const long = scanEvidence([{ feedbackId: "a", text: "x".repeat(DEFAULT_POLICY.maxTextLength + 1) }]);
  assert.deepEqual(long.records[0].reasons, ["text_too_long"]);
});

test("scanEvidence: policy must classify every finding type exactly once", () => {
  assert.throws(() => scanEvidence([], { redactable: ["email"], blocking: ["ssn"] }), /must classify/);
  assert.throws(() => scanEvidence([], { redactable: ["email", "phone", "ipv4", "iban", "ssn"], blocking: ["card_number", "ssn", "secret"] }), /both/);
  const strict = scanEvidence([{ feedbackId: "a", text: "mail me a@b.co" }], {
    redactable: ["phone", "ipv4", "iban"],
    blocking: ["email", "card_number", "ssn", "secret"],
  });
  assert.equal(strict.records[0].status, "blocked");
});

test("decideGate: validates the named decision and never mutates evidence", () => {
  const scan = scanEvidence([
    { feedbackId: "ok", text: "clean" },
    { feedbackId: "red", text: "call 415-555-0134" },
    { feedbackId: "blk", text: "ssn 123-45-6789" },
  ]);
  assert.throws(() => decideGate({ scan, decision: "approve", decidedBy: "Priya", rationale: "long enough text" }), /decision must be/);
  assert.throws(() => decideGate({ scan, decision: "admit_redacted", decidedBy: "", rationale: "long enough text" }), /decidedBy/);
  assert.throws(() => decideGate({ scan, decision: "admit_redacted", decidedBy: "Priya", rationale: "short" }), /rationale/);
  const record = decideGate({ scan, decision: "admit_redacted", decidedBy: "Priya", rationale: "Blocked record goes to quarantine for manual review.", decidedAt: "2026-10-04T12:00:00Z" });
  assert.deepEqual(record.admittedFeedbackIds, ["ok", "red"]);
  assert.deepEqual(record.quarantinedFeedbackIds, ["blk"]);
  assert.deepEqual(record.rejectedFeedbackIds, []);
  assert.equal(scan.records.length, 3); // scan untouched
  const clean = scanEvidence([{ feedbackId: "a", text: "fine" }]);
  assert.throws(() => decideGate({ scan: clean, decision: "quarantine", decidedBy: "P", rationale: "nothing is blocked here" }), /not applicable/);
  const empty = scanEvidence([]);
  assert.throws(() => decideGate({ scan: empty, decision: "admit_redacted", decidedBy: "P", rationale: "nothing to admit really" }), /reject_batch/);
});
