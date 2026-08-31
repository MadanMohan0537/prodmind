const POSITIVE_WORDS = ["love", "great", "fast", "easy", "helpful", "excellent", "happy"];
const NEGATIVE_WORDS = ["bug", "broken", "slow", "crash", "hard", "confusing", "hate", "error"];
const REQUEST_PHRASES = ["please add", "would like", "wish", "feature", "can you", "need", "should"];
const NEGATIONS = new Set(["not", "never", "no", "isn't", "wasn't", "without"]);

export function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function canonicalize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, "")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join("|");
}

function hasNonNegatedWord(tokens, target) {
  return tokens.some((token, index) => {
    if (token !== target) return false;
    return !tokens.slice(Math.max(0, index - 2), index).some(word => NEGATIONS.has(word));
  });
}

export function analyze(text) {
  const normalized = normalizeText(text).toLowerCase();
  const tokens = normalized.match(/[a-z']+/g) || [];
  const positiveHits = POSITIVE_WORDS.filter(word => hasNonNegatedWord(tokens, word));
  const negativeHits = NEGATIVE_WORDS.filter(word => hasNonNegatedWord(tokens, word));
  const score = positiveHits.length - negativeHits.length;
  const requestHits = REQUEST_PHRASES.filter(phrase => normalized.includes(phrase));
  const bugHits = ["bug", "crash", "error", "broken"].filter(word => hasNonNegatedWord(tokens, word));
  const totalSignals = positiveHits.length + negativeHits.length + requestHits.length + bugHits.length;

  return {
    sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    intent: requestHits.length ? "feature-request" : bugHits.length ? "bug" : "general",
    confidence: totalSignals ? Math.min(0.95, 0.55 + totalSignals * 0.1) : 0.35,
    classifier: "rules-en-v2",
    matchedSignals: [...new Set([...positiveHits, ...negativeHits, ...requestHits, ...bugHits])]
  };
}

export function validateInput(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["record must be an object"];
  const text = record.text ?? record.feedback ?? record.comment ?? record.review;
  if (typeof text !== "string" || !normalizeText(text)) errors.push("text is required and must be a non-empty string");
  if (typeof text === "string" && text.length > 100_000) errors.push("text must not exceed 100,000 characters");
  if (record.source !== undefined && typeof record.source !== "string") errors.push("source must be a string");
  if (record.metadata !== undefined && (typeof record.metadata !== "object" || Array.isArray(record.metadata) || record.metadata === null)) errors.push("metadata must be an object");
  const date = record.createdAt ?? record.timestamp;
  if (date !== undefined && Number.isNaN(Date.parse(date))) errors.push("createdAt must be a valid date-time");
  return errors;
}

export function validateEvent(event) {
  const errors = [];
  for (const field of ["id", "schemaVersion", "text", "source", "createdAt", "fingerprint"]) {
    if (typeof event[field] !== "string" || !event[field]) errors.push(`${field} is required`);
  }
  if (event.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  if (!["positive", "neutral", "negative"].includes(event.sentiment)) errors.push("sentiment is invalid");
  if (!["feature-request", "bug", "general"].includes(event.intent)) errors.push("intent is invalid");
  if (typeof event.confidence !== "number" || event.confidence < 0 || event.confidence > 1) errors.push("confidence must be between 0 and 1");
  if (!/^[a-f0-9]{64}$/.test(event.fingerprint || "")) errors.push("fingerprint must be a SHA-256 hex digest");
  return errors;
}

export function normalizeRecord(record, index = 0) {
  if (validateInput(record).length) return null;
  const text = normalizeText(record.text ?? record.feedback ?? record.comment ?? record.review);
  return {
    id: record.id || `feedback-${Date.now()}-${index}`,
    text,
    source: normalizeText(record.source || "import"),
    customer: normalizeText(record.customer || record.user || "Anonymous"),
    createdAt: record.createdAt || record.timestamp || new Date().toISOString(),
    metadata: record.metadata || {},
    ...analyze(text)
  };
}

export function deduplicate(records) {
  const seen = new Set();
  return records.filter(record => {
    const key = canonicalize(record.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"' && quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift();
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}
