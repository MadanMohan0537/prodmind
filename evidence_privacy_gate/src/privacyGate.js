/**
 * Project 36: Product Evidence Privacy Gate
 *
 * Deterministic detection and pseudonymization of personal and secret data in
 * customer evidence before it enters the ProdMind workflow. The gate never
 * stores, deletes or forwards records: it returns a scan report, a redacted
 * copy, and a gate status that requires a named human decision when blocked
 * findings exist.
 *
 * No model, no paid service, no network access.
 */

export const FINDING_TYPES = Object.freeze({
  email: "email",
  phone: "phone",
  card_number: "card_number",
  ssn: "ssn",
  ipv4: "ipv4",
  secret: "secret",
  iban: "iban",
});

export const SEVERITY = Object.freeze({
  email: "medium",
  phone: "medium",
  ipv4: "low",
  iban: "high",
  card_number: "critical",
  ssn: "critical",
  secret: "critical",
});

export const DEFAULT_POLICY = Object.freeze({
  /** Finding types that may be admitted after redaction. */
  redactable: Object.freeze(["email", "phone", "ipv4", "iban"]),
  /** Finding types that block the record until a human decides. */
  blocking: Object.freeze(["card_number", "ssn", "secret"]),
  /** Salt that makes pseudonyms stable within a deployment but not guessable across deployments. */
  pseudonymSalt: "prodmind",
  /** Records longer than this are rejected as malformed evidence. */
  maxTextLength: 20000,
});

const DETECTORS = [
  {
    type: FINDING_TYPES.email,
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    type: FINDING_TYPES.card_number,
    pattern: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g,
    accept: (match) => {
      const digits = match.replace(/[ -]/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhn(digits);
    },
  },
  {
    type: FINDING_TYPES.ssn,
    pattern: /(?<!\d)(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?!\d)/g,
  },
  {
    type: FINDING_TYPES.iban,
    pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
    accept: (match) => ibanValid(match.replace(/ /g, "")),
  },
  {
    type: FINDING_TYPES.phone,
    pattern: /(?<![\w.])(?:\+?\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})[ .-]?\d{3,4}[ .-]?\d{3,4}(?![\w.])/g,
    accept: (match, context) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) return false;
      // A bare digit run without "+" or separators is an order or account number unless it is 10-11 digits.
      if (!/[+ .()-]/.test(match) && digits.length > 11) return false;
      // A phone number is not part of a longer digit sequence (card or account numbers).
      if (/\d[ .-]?$/.test(context.before) || /^[ .-]?\d/.test(context.after)) return false;
      return true;
    },
  },
  {
    type: FINDING_TYPES.ipv4,
    pattern: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
  },
  {
    type: FINDING_TYPES.secret,
    pattern: /\b(?:sk|pk|ghp|gho|xox[bpas]|AKIA)[A-Za-z0-9_-]{16,}\b|\b(?:bearer|token|api[_-]?key|password)\s*[:=]\s*[^\s"']{8,}/gi,
  },
];

export function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (!Number.isInteger(n)) return false;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

function ibanValid(iban) {
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** FNV-1a 32-bit hash, hex encoded. Stable pseudonym, not a security primitive. */
export function pseudonym(value, salt = DEFAULT_POLICY.pseudonymSalt) {
  const input = `${salt}:${value.toLowerCase().replace(/[\s-]/g, "")}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizePolicy(policy) {
  const merged = { ...DEFAULT_POLICY, ...(policy ?? {}) };
  const redactable = new Set(merged.redactable);
  const blocking = new Set(merged.blocking);
  for (const type of Object.values(FINDING_TYPES)) {
    if (!redactable.has(type) && !blocking.has(type)) {
      throw new Error(`Policy must classify finding type "${type}" as redactable or blocking.`);
    }
    if (redactable.has(type) && blocking.has(type)) {
      throw new Error(`Policy classifies finding type "${type}" as both redactable and blocking.`);
    }
  }
  if (!Number.isInteger(merged.maxTextLength) || merged.maxTextLength <= 0) {
    throw new Error("Policy maxTextLength must be a positive integer.");
  }
  return { ...merged, redactable, blocking };
}

/**
 * Scan one text and return non-overlapping findings ordered by position.
 * Earlier detectors win on overlap, so a card number is never also a phone.
 */
export function detect(text) {
  const findings = [];
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0;
    for (const match of text.matchAll(detector.pattern)) {
      const value = match[0];
      const start = match.index;
      const end = start + value.length;
      const context = { before: text.slice(Math.max(0, start - 3), start), after: text.slice(end, end + 3) };
      if (detector.accept && !detector.accept(value, context)) continue;
      if (findings.some((f) => f.start < end && f.end > start)) continue;
      findings.push({ type: detector.type, severity: SEVERITY[detector.type], start, end, value });
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}

function redactText(text, findings, salt) {
  let out = "";
  let cursor = 0;
  for (const finding of findings) {
    out += text.slice(cursor, finding.start);
    out += `[${finding.type.toUpperCase()}#${pseudonym(finding.value, salt)}]`;
    cursor = finding.end;
  }
  return out + text.slice(cursor);
}

/**
 * Scan a batch of evidence records.
 *
 * @param {Array<{feedbackId: string, text: string}>} records
 * @param {object} [policy]
 * @returns {{
 *   policy: object,
 *   records: Array<{feedbackId, status, findings, redactedText, reasons}>,
 *   summary: {total, clean, redacted, blocked, malformed, byType},
 *   gateStatus: "admit" | "decision_required" | "reject",
 *   decisionRequired: boolean
 * }}
 */
export function scanEvidence(records, policy) {
  if (!Array.isArray(records)) throw new Error("records must be an array.");
  const normalized = normalizePolicy(policy);
  const seen = new Set();
  const byType = {};
  const output = [];

  for (const record of records) {
    const feedbackId = record?.feedbackId;
    const reasons = [];
    if (typeof feedbackId !== "string" || feedbackId.trim() === "") {
      output.push({ feedbackId: null, status: "malformed", findings: [], redactedText: null, reasons: ["missing_feedback_id"] });
      continue;
    }
    if (seen.has(feedbackId)) reasons.push("duplicate_feedback_id");
    seen.add(feedbackId);

    const text = record.text;
    if (typeof text !== "string") {
      output.push({ feedbackId, status: "malformed", findings: [], redactedText: null, reasons: [...reasons, "text_not_string"] });
      continue;
    }
    if (text.length > normalized.maxTextLength) {
      output.push({ feedbackId, status: "malformed", findings: [], redactedText: null, reasons: [...reasons, "text_too_long"] });
      continue;
    }

    const findings = detect(text).map((f) => {
      byType[f.type] = (byType[f.type] ?? 0) + 1;
      return { type: f.type, severity: f.severity, start: f.start, end: f.end, pseudonym: pseudonym(f.value, normalized.pseudonymSalt) };
    });
    const raw = detect(text);
    const blocked = raw.some((f) => normalized.blocking.has(f.type));
    const status = reasons.includes("duplicate_feedback_id")
      ? "malformed"
      : blocked
        ? "blocked"
        : findings.length > 0
          ? "redacted"
          : "clean";

    output.push({
      feedbackId,
      status,
      findings,
      // Redacted text is produced for every record so a reviewer can read a blocked
      // record without seeing the raw value. Raw values are never returned.
      redactedText: redactText(text, raw, normalized.pseudonymSalt),
      reasons,
    });
  }

  const summary = {
    total: output.length,
    clean: output.filter((r) => r.status === "clean").length,
    redacted: output.filter((r) => r.status === "redacted").length,
    blocked: output.filter((r) => r.status === "blocked").length,
    malformed: output.filter((r) => r.status === "malformed").length,
    byType,
  };

  const gateStatus = summary.total === 0 || summary.malformed === summary.total
    ? "reject"
    : summary.blocked > 0
      ? "decision_required"
      : "admit";

  return {
    policy: {
      redactable: [...normalized.redactable].sort(),
      blocking: [...normalized.blocking].sort(),
      maxTextLength: normalized.maxTextLength,
    },
    records: output,
    summary,
    gateStatus,
    decisionRequired: gateStatus === "decision_required",
  };
}

const DECISIONS = Object.freeze(["admit_redacted", "quarantine", "reject_batch"]);

/**
 * Record a named human decision for a scan. The function validates the
 * decision against the scan and returns a decision record; it never admits,
 * stores or deletes evidence itself.
 */
export function decideGate({ scan, decision, decidedBy, rationale, decidedAt }) {
  if (!scan || !Array.isArray(scan.records)) throw new Error("A scan result is required.");
  if (!DECISIONS.includes(decision)) throw new Error(`decision must be one of ${DECISIONS.join(", ")}.`);
  if (typeof decidedBy !== "string" || decidedBy.trim() === "") throw new Error("decidedBy must name a person.");
  if (typeof rationale !== "string" || rationale.trim().length < 10) throw new Error("rationale must explain the decision (10+ characters).");
  if (decidedAt !== undefined && Number.isNaN(Date.parse(decidedAt))) throw new Error("decidedAt must be an ISO date.");

  if (scan.gateStatus === "reject" && decision !== "reject_batch") {
    throw new Error("A rejected scan can only be closed with reject_batch.");
  }
  if (scan.gateStatus === "admit" && decision === "quarantine") {
    throw new Error("Nothing is blocked; quarantine is not applicable.");
  }

  const admitted = decision === "admit_redacted"
    ? scan.records.filter((r) => r.status === "clean" || r.status === "redacted").map((r) => r.feedbackId)
    : [];
  const quarantined = decision === "admit_redacted" || decision === "quarantine"
    ? scan.records.filter((r) => r.status === "blocked").map((r) => r.feedbackId)
    : [];
  const rejected = decision === "reject_batch"
    ? scan.records.map((r) => r.feedbackId).filter(Boolean)
    : scan.records.filter((r) => r.status === "malformed").map((r) => r.feedbackId).filter(Boolean);

  return {
    decision,
    decidedBy,
    rationale,
    decidedAt: decidedAt ?? null,
    gateStatus: scan.gateStatus,
    admittedFeedbackIds: admitted,
    quarantinedFeedbackIds: quarantined,
    rejectedFeedbackIds: rejected,
    summary: scan.summary,
    boundary: "Decision recorded only; no evidence was stored, deleted, or forwarded by this engine.",
  };
}
