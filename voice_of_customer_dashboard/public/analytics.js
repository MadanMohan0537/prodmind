const DAY_MS = 86_400_000;

function text(value, fallback = "unknown") {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function list(value) {
  if (Array.isArray(value)) return [...new Set(value.map(item => text(item, "")).filter(Boolean))];
  if (typeof value === "string") return [...new Set(value.split(",").map(item => text(item, "")).filter(Boolean))];
  return [];
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  return Number(finite(value).toFixed(digits));
}

export function normalizeEvent(event, index = 0) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new TypeError("event must be an object");
  const body = text(event.text, "");
  if (!body) throw new TypeError("event.text must be a non-empty string");
  if (body.length > 20_000) throw new RangeError("event.text must not exceed 20,000 characters");
  const timestamp = new Date(event.timestamp || event.createdAt || Date.now());
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("event.timestamp must be a valid date");
  const rawSentiment = event.sentiment?.score ?? event.sentimentScore ?? event.sentiment ?? 0;
  const sentiment = Math.max(-1, Math.min(1, finite(rawSentiment)));
  return {
    id: text(event.id, `event-${index + 1}`),
    timestamp: timestamp.toISOString(),
    source: text(event.source),
    segment: text(event.segment),
    customerId: text(event.customerId || event.userId, "anonymous"),
    text: body,
    sentiment: round(sentiment),
    topics: list(event.topics || event.topic),
    intents: list(event.intents?.map?.(item => item.label || item) || event.intents || event.intent),
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  };
}

export function filterEvents(events, filters = {}) {
  const from = filters.from ? new Date(filters.from).getTime() : -Infinity;
  const to = filters.to ? new Date(filters.to).getTime() + DAY_MS - 1 : Infinity;
  const sources = list(filters.sources || filters.source).map(value => value.toLowerCase());
  const segments = list(filters.segments || filters.segment).map(value => value.toLowerCase());
  const topics = list(filters.topics || filters.topic).map(value => value.toLowerCase());
  const query = text(filters.query, "").toLowerCase();
  return events.filter(event => {
    const time = new Date(event.timestamp).getTime();
    return time >= from && time <= to
      && (!sources.length || sources.includes(event.source.toLowerCase()))
      && (!segments.length || segments.includes(event.segment.toLowerCase()))
      && (!topics.length || event.topics.some(topic => topics.includes(topic.toLowerCase())))
      && (!query || event.text.toLowerCase().includes(query));
  });
}

function distribution(events, getter) {
  const counts = new Map();
  events.forEach(event => getter(event).forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
  return [...counts.entries()].map(([name, count]) => ({ name, count, share: round(count / Math.max(events.length, 1)) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function daily(events) {
  const days = new Map();
  events.forEach(event => {
    const date = event.timestamp.slice(0, 10);
    const row = days.get(date) || { date, volume: 0, sentimentTotal: 0, negative: 0 };
    row.volume += 1;
    row.sentimentTotal += event.sentiment;
    row.negative += event.sentiment < -0.2 ? 1 : 0;
    days.set(date, row);
  });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({
    date: row.date,
    volume: row.volume,
    averageSentiment: round(row.sentimentTotal / row.volume),
    negativeRate: round(row.negative / row.volume)
  }));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function deviation(values, average) {
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
}

export function detectAnomalies(trends, options = {}) {
  const window = Math.max(2, Math.min(30, Number(options.window || 7)));
  const zThreshold = Math.max(1, Number(options.zThreshold || 2));
  const sentimentDrop = Math.max(0.1, Number(options.sentimentDrop || 0.3));
  const anomalies = [];
  trends.forEach((current, index) => {
    const history = trends.slice(Math.max(0, index - window), index);
    if (history.length < 2) return;
    const volumes = history.map(row => row.volume);
    const baseline = mean(volumes);
    const sd = deviation(volumes, baseline);
    const zScore = sd ? (current.volume - baseline) / sd : current.volume > baseline ? current.volume - baseline : 0;
    if (zScore >= zThreshold) anomalies.push({
      id: `volume-${current.date}`,
      date: current.date,
      type: "volume-spike",
      severity: zScore >= zThreshold * 1.5 ? "high" : "medium",
      value: current.volume,
      baseline: round(baseline, 2),
      score: round(zScore, 2),
      message: `Feedback volume rose to ${current.volume} versus a ${round(baseline, 1)}-item baseline.`
    });
    const sentimentBaseline = mean(history.map(row => row.averageSentiment));
    const drop = sentimentBaseline - current.averageSentiment;
    if (drop >= sentimentDrop) anomalies.push({
      id: `sentiment-${current.date}`,
      date: current.date,
      type: "sentiment-drop",
      severity: drop >= sentimentDrop * 1.5 ? "high" : "medium",
      value: current.averageSentiment,
      baseline: round(sentimentBaseline),
      score: round(drop, 2),
      message: `Average sentiment fell ${round(drop, 2)} points below its recent baseline.`
    });
  });
  return anomalies.sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);
}

export function buildDashboard(input, filters = {}, options = {}) {
  if (!Array.isArray(input)) throw new TypeError("events must be an array");
  if (input.length > 10_000) throw new RangeError("maximum analysis size is 10,000 events");
  const normalized = input.map(normalizeEvent);
  const events = filterEvents(normalized, filters);
  const trends = daily(events);
  const negative = events.filter(event => event.sentiment < -0.2).length;
  const summary = {
    totalFeedback: events.length,
    uniqueCustomers: new Set(events.map(event => event.customerId).filter(value => value !== "anonymous")).size,
    averageSentiment: round(mean(events.map(event => event.sentiment))),
    negativeRate: round(negative / Math.max(events.length, 1)),
    needsAttention: negative
  };
  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    filters,
    summary,
    trends,
    topics: distribution(events, event => event.topics.length ? event.topics : ["Uncategorized"]),
    sources: distribution(events, event => [event.source]),
    segments: distribution(events, event => [event.segment]),
    intents: distribution(events, event => event.intents.length ? event.intents : ["unclassified"]),
    anomalies: detectAnomalies(trends, options),
    evidence: [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, Number(options.evidenceLimit || 50))
  };
}

export function parseJsonInput(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records)) throw new TypeError("input must be an array or an object with a records array");
  return records;
}
