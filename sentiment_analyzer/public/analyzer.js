const LEXICONS = {
  en: {
    positive: { love: 3, excellent: 3, amazing: 3, great: 2, good: 2, helpful: 2, easy: 2, fast: 2, useful: 2, happy: 2, like: 1, works: 1 },
    negative: { hate: -3, terrible: -3, broken: -3, crash: -3, awful: -3, bad: -2, slow: -2, confusing: -2, difficult: -2, error: -2, bug: -2, frustrating: -2, hard: -1 }
  },
  es: {
    positive: { excelente: 3, increíble: 3, genial: 2, bueno: 2, buena: 2, útil: 2, fácil: 2, rápido: 2, rápida: 2, encanta: 3, funciona: 1 },
    negative: { odio: -3, terrible: -3, roto: -3, rota: -3, falla: -3, malo: -2, mala: -2, lento: -2, lenta: -2, confuso: -2, difícil: -2, error: -2, frustrante: -2 }
  }
};

const NEGATIONS = {
  en: new Set(["not", "never", "no", "isn't", "wasn't", "don't", "doesn't", "without"]),
  es: new Set(["no", "nunca", "jamás", "sin"])
};
const INTENSIFIERS = new Set(["very", "really", "extremely", "super", "muy", "realmente", "súper"]);
const POSITIVE_EMOJI = new Set(["😀", "😃", "😍", "❤️", "👍", "🎉"]);
const NEGATIVE_EMOJI = new Set(["😞", "😡", "🤬", "👎", "💔", "😭"]);
const ASPECTS = {
  performance: ["fast", "slow", "speed", "latency", "rápido", "lento", "rendimiento"],
  usability: ["easy", "hard", "confusing", "simple", "fácil", "difícil", "confuso"],
  reliability: ["crash", "bug", "error", "broken", "falla", "roto"],
  support: ["support", "help", "agent", "ticket", "soporte", "ayuda"]
};

export function detectLanguage(text) {
  const value = text.toLowerCase();
  const spanishSignals = [" el ", " la ", " muy ", "pero", "fácil", "rápido", "lento", "bueno", "malo"];
  return spanishSignals.filter(signal => ` ${value} `.includes(signal)).length >= 1 ? "es" : "en";
}

export function tokenize(text) {
  return text.toLowerCase().match(/[\p{L}']+|[😀😃😍❤️👍🎉😞😡🤬👎💔😭]/gu) || [];
}

export function analyzeSentiment(text, options = {}) {
  if (typeof text !== "string" || !text.trim()) throw new TypeError("text must be a non-empty string");
  if (text.length > 100_000) throw new RangeError("text must not exceed 100,000 characters");
  const language = options.language || detectLanguage(text);
  const lexicon = LEXICONS[language] || LEXICONS.en;
  const negations = NEGATIONS[language] || NEGATIONS.en;
  const tokens = tokenize(text);
  const evidence = [];
  let rawScore = 0;

  tokens.forEach((token, index) => {
    let weight = lexicon.positive[token] || lexicon.negative[token] || 0;
    if (POSITIVE_EMOJI.has(token)) weight = 2;
    if (NEGATIVE_EMOJI.has(token)) weight = -2;
    if (!weight) return;
    const context = tokens.slice(Math.max(0, index - 3), index);
    const negated = context.some(word => negations.has(word));
    const intensified = context.some(word => INTENSIFIERS.has(word));
    if (negated) weight *= -1;
    if (intensified) weight *= 1.5;
    rawScore += weight;
    evidence.push({ token, weight, negated, intensified, position: index });
  });

  const normalizedScore = Math.max(-1, Math.min(1, rawScore / Math.max(3, Math.sqrt(tokens.length) * 3)));
  const label = normalizedScore > 0.15 ? "positive" : normalizedScore < -0.15 ? "negative" : "neutral";
  const confidence = evidence.length ? Math.min(0.96, 0.55 + evidence.length * 0.07 + Math.abs(normalizedScore) * 0.18) : 0.3;
  const aspects = Object.entries(ASPECTS)
    .filter(([, keywords]) => keywords.some(keyword => tokens.includes(keyword)))
    .map(([name]) => name);

  return {
    schemaVersion: "1.0",
    label,
    score: Number(normalizedScore.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    language,
    model: "explainable-lexicon-v1",
    evidence,
    aspects,
    needsReview: confidence < (options.reviewThreshold ?? 0.55)
  };
}

export function analyzeFeedbackEvent(event) {
  if (!event || typeof event !== "object") throw new TypeError("feedback event must be an object");
  const sentiment = analyzeSentiment(event.text, { language: event.language });
  return { eventId: event.id || null, analyzedAt: new Date().toISOString(), ...sentiment };
}
