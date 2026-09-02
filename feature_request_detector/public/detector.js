const RULES = {
  "feature-request": [
    { pattern: /\b(?:please|kindly)\s+(?:add|build|support|allow|enable|create|include)\b/i, weight: 3, signal: "explicit request" },
    { pattern: /\b(?:i|we)\s+(?:want|need|would like|wish)\b/i, weight: 3, signal: "stated need" },
    { pattern: /\b(?:could|can|would)\s+(?:you|we)\b/i, weight: 2, signal: "request question" },
    { pattern: /\b(?:feature request|missing feature|it should|should support|ability to|option to|way to)\b/i, weight: 2.5, signal: "capability request" },
    { pattern: /\b(?:unless|until)\s+(?:you|we)\s+(?:add|build|support|allow|enable|fix)\b/i, weight: 2.5, signal: "conditional request" },
    { pattern: /\b(?:if only|wish there was|currently impossible|cannot currently|can't currently)\b/i, weight: 2, signal: "implicit unmet need" }
  ],
  "bug-report": [
    { pattern: /\b(?:bug|broken|crash(?:es|ed|ing)?|error|exception|freeze[sd]?|stuck|fails?|failure)\b/i, weight: 3, signal: "failure term" },
    { pattern: /\b(?:does not|doesn't|won't|cannot|can't)\s+(?:work|load|open|save|submit|sync|connect)\b/i, weight: 3, signal: "failed behavior" },
    { pattern: /\b(?:unexpected|incorrect|wrong|regression)\b/i, weight: 2, signal: "incorrect behavior" }
  ],
  complaint: [
    { pattern: /\b(?:frustrating|annoying|difficult|confusing|slow|terrible|awful|hate|unusable)\b/i, weight: 2.5, signal: "negative experience" },
    { pattern: /\b(?:too many|takes too long|waste of time|hard to)\b/i, weight: 2, signal: "friction" }
  ],
  praise: [
    { pattern: /\b(?:love|excellent|amazing|great|helpful|easy|fantastic|perfect)\b/i, weight: 2.5, signal: "positive experience" },
    { pattern: /\b(?:thank you|thanks|well done|works well)\b/i, weight: 2, signal: "positive acknowledgment" }
  ],
  question: [
    { pattern: /\?/, weight: 1.5, signal: "question mark" },
    { pattern: /^(?:how|why|when|where|what|is there|do you|does it|can i|can you|could you|would you)\b/i, weight: 2, signal: "question phrase" }
  ],
  "churn-risk": [
    { pattern: /\b(?:cancel|cancelling|canceling|leave|leaving|switch(?:ing)?|competitor|refund|uninstall)\b/i, weight: 3, signal: "exit language" },
    { pattern: /\b(?:deal.?breaker|last chance|otherwise we|renewal)\b/i, weight: 2.5, signal: "retention warning" }
  ]
};

const URGENCY = [
  { pattern: /\b(?:urgent|urgently|asap|immediately|critical|blocker|blocking)\b/i, score: 3, signal: "urgent language" },
  { pattern: /\b(?:today|deadline|cannot proceed|can't proceed)\b/i, score: 2, signal: "time pressure" }
];
const IMPACT = [
  { pattern: /\b(?:all users|everyone|entire team|company-wide|production)\b/i, score: 3, signal: "broad impact" },
  { pattern: /\b(?:team|customers|multiple users|workflow|revenue)\b/i, score: 2, signal: "business impact" },
  { pattern: /\b(?:i|me|my)\b/i, score: 1, signal: "individual impact" }
];

export function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function splitSentences(text) {
  return normalizeText(text).match(/[^.!?]+[.!?]?/g)?.map(value => value.trim()).filter(Boolean) || [];
}

function scanRules(text, rules) {
  return rules.filter(rule => rule.pattern.test(text)).map(rule => ({ signal: rule.signal, weight: rule.weight, match: text.match(rule.pattern)?.[0] || "" }));
}

function scoreLevel(score, medium, high) {
  return score >= high ? "high" : score >= medium ? "medium" : "low";
}

function detectSignals(text, definitions) {
  const matches = definitions.filter(item => item.pattern.test(text));
  const score = Math.max(0, ...matches.map(item => item.score));
  return { score, evidence: matches.map(item => item.signal) };
}

export function detectIntents(text, options = {}) {
  const normalized = normalizeText(text);
  if (!normalized) throw new TypeError("text must be a non-empty string");
  if (normalized.length > 20_000) throw new RangeError("text must not exceed 20,000 characters");
  const threshold = Number(options.threshold ?? 0.42);
  if (!Number.isFinite(threshold) || threshold < 0.1 || threshold > 0.95) throw new RangeError("threshold must be between 0.1 and 0.95");
  const sentences = splitSentences(normalized);
  const intents = [];

  for (const [label, rules] of Object.entries(RULES)) {
    const evidence = [];
    let score = 0;
    sentences.forEach((sentence, sentenceIndex) => {
      const hits = scanRules(sentence, rules);
      if (hits.length) {
        score += hits.reduce((sum, hit) => sum + hit.weight, 0);
        evidence.push({ sentenceIndex, sentence, signals: hits });
      }
    });
    const confidence = Math.min(0.98, 1 - Math.exp(-score / 3.5));
    if (confidence >= threshold) intents.push({ label, confidence: Number(confidence.toFixed(4)), evidence });
  }

  intents.sort((left, right) => right.confidence - left.confidence);
  const urgency = detectSignals(normalized, URGENCY);
  const impact = detectSignals(normalized, IMPACT);
  const primaryIntent = intents[0]?.label || "unclassified";
  const confidence = intents[0]?.confidence || 0.2;
  const request = intents.find(intent => intent.label === "feature-request");
  return {
    schemaVersion: "1.0.0",
    model: "prodmind-explainable-multilabel-v1",
    primaryIntent,
    intents,
    isFeatureRequest: Boolean(request),
    requestType: request ? (request.evidence.some(item => item.signals.some(signal => signal.signal.startsWith("implicit"))) ? "implicit" : "explicit") : null,
    confidence,
    urgency: { level: scoreLevel(urgency.score, 2, 3), ...urgency },
    impact: { level: scoreLevel(impact.score, 2, 3), ...impact },
    needsReview: primaryIntent === "unclassified" || confidence < Number(options.reviewThreshold ?? 0.62),
    sentenceCount: sentences.length
  };
}

export function detectFeedbackEvent(event, options = {}) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new TypeError("feedback event must be an object");
  const result = detectIntents(event.text, options);
  return { eventId: event.id || null, source: event.source || "unknown", analyzedAt: new Date().toISOString(), ...result };
}
