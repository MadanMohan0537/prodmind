const STOPWORDS = new Set(`a an and are as at be been but by can could did do for from had has have he her hers him his how i if in into is it its may me more most my no not of on or our ours she so than that the their them then there these they this those to too us was we were what when where which who will with would you your y para de la el los las un una que en con por es se del al como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras`.split(/\s+/));

export function tokenize(text) {
  return String(text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9][a-z0-9'-]{1,}/g)?.filter(token => !STOPWORDS.has(token)) || [];
}

function vector(tokens) {
  const counts = {};
  for (const token of tokens) counts[token] = (counts[token] || 0) + 1;
  const norm = Math.sqrt(Object.values(counts).reduce((sum, value) => sum + value * value, 0)) || 1;
  for (const token of Object.keys(counts)) counts[token] /= norm;
  return counts;
}

export function cosine(a, b) {
  const small = Object.keys(a).length < Object.keys(b).length ? a : b;
  const large = small === a ? b : a;
  return Object.entries(small).reduce((sum, [key, value]) => sum + value * (large[key] || 0), 0);
}

function normalizeDocument(document, index) {
  const item = typeof document === "string" ? { text: document } : document;
  if (!item?.text || typeof item.text !== "string") throw new Error(`Document ${index + 1} requires text`);
  if (item.text.length > 20_000) throw new Error(`Document ${index + 1} exceeds 20,000 characters`);
  const timestamp = item.timestamp ? new Date(item.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) throw new Error(`Document ${index + 1} has an invalid timestamp`);
  return { id: item.id || `document-${index + 1}`, text: item.text.trim(), source: item.source || "unknown", timestamp: timestamp.toISOString(), reliability: Math.max(0, Math.min(1, Number(item.reliability ?? 1))) };
}

function documentWeight(document, now, halfLifeDays) {
  const ageDays = Math.max(0, (now - new Date(document.timestamp)) / 86_400_000);
  return document.reliability * Math.pow(0.5, ageDays / halfLifeDays);
}

function keywords(documents, allDocuments, now, halfLifeDays, limit = 8) {
  const scores = {};
  const globalDf = {};
  for (const document of allDocuments) for (const token of new Set(tokenize(document.text))) globalDf[token] = (globalDf[token] || 0) + 1;
  for (const document of documents) {
    const weight = documentWeight(document, now, halfLifeDays);
    for (const token of tokenize(document.text)) scores[token] = (scores[token] || 0) + weight;
  }
  return Object.entries(scores).map(([term, tf]) => ({ term, score: tf * Math.log(1 + allDocuments.length / (globalDf[term] || 1)) }))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term)).slice(0, limit)
    .map(item => ({ term: item.term, score: Number(item.score.toFixed(4)) }));
}

function distribution(documents) {
  const counts = {};
  let total = 0;
  for (const document of documents) for (const token of tokenize(document.text)) { counts[token] = (counts[token] || 0) + 1; total += 1; }
  for (const token of Object.keys(counts)) counts[token] /= total || 1;
  return counts;
}

export function klDivergence(previous, current, smoothing = 1e-6) {
  const terms = new Set([...Object.keys(previous), ...Object.keys(current)]);
  let score = 0;
  for (const term of terms) {
    const p = (current[term] || 0) + smoothing;
    const q = (previous[term] || 0) + smoothing;
    score += p * Math.log(p / q);
  }
  return Math.max(0, score);
}

export function detectDrift(documents) {
  if (documents.length < 4) return { score: 0, level: "insufficient-data", message: "Add at least four documents to compare time windows." };
  const sorted = [...documents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const midpoint = Math.floor(sorted.length / 2);
  const score = klDivergence(distribution(sorted.slice(0, midpoint)), distribution(sorted.slice(midpoint)));
  const level = score >= 1 ? "high" : score >= 0.35 ? "moderate" : "stable";
  return { score: Number(score.toFixed(4)), level, previousDocuments: midpoint, currentDocuments: sorted.length - midpoint };
}

function hierarchy(topics, threshold) {
  const parents = [];
  const used = new Set();
  for (const topic of topics) {
    if (used.has(topic.id)) continue;
    const children = [topic];
    used.add(topic.id);
    for (const candidate of topics) {
      if (!used.has(candidate.id) && cosine(topic.centroid, candidate.centroid) >= threshold) { children.push(candidate); used.add(candidate.id); }
    }
    parents.push({ id: `group-${parents.length + 1}`, label: children.map(child => child.label).slice(0, 2).join(" + "), children: children.map(child => child.id) });
  }
  return parents;
}

export function modelTopics(input, options = {}) {
  const documents = input.map(normalizeDocument);
  if (!documents.length) throw new Error("At least one document is required");
  const threshold = Number(options.similarityThreshold ?? 0.28);
  const halfLifeDays = Number(options.halfLifeDays ?? 30);
  const clusters = [];
  const assignments = [];
  for (const document of documents) {
    const documentVector = vector(tokenize(document.text));
    let best = { index: -1, similarity: -1 };
    clusters.forEach((cluster, index) => { const similarity = cosine(documentVector, cluster.centroid); if (similarity > best.similarity) best = { index, similarity }; });
    if (best.index < 0 || best.similarity < threshold) clusters.push({ documents: [document], vectors: [documentVector], centroid: documentVector });
    else {
      const cluster = clusters[best.index];
      cluster.documents.push(document); cluster.vectors.push(documentVector);
      const merged = {};
      for (const item of cluster.vectors) for (const [key, value] of Object.entries(item)) merged[key] = (merged[key] || 0) + value / cluster.vectors.length;
      cluster.centroid = merged;
    }
  }
  const now = new Date(Math.max(...documents.map(document => new Date(document.timestamp).getTime())));
  const topics = clusters.map((cluster, index) => {
    const terms = keywords(cluster.documents, documents, now, halfLifeDays);
    const id = `topic-${index + 1}`;
    cluster.documents.forEach(document => assignments.push({ documentId: document.id, topicId: id, similarity: Number(cosine(vector(tokenize(document.text)), cluster.centroid).toFixed(4)) }));
    return { id, label: terms.slice(0, 3).map(item => item.term).join(" · ") || "Unclassified", documentCount: cluster.documents.length, share: Number((cluster.documents.length / documents.length).toFixed(4)), keywords: terms, sources: [...new Set(cluster.documents.map(document => document.source))], centroid: cluster.centroid };
  }).sort((a, b) => b.documentCount - a.documentCount);
  return { schemaVersion: "1.0.0", model: "prodmind-online-weighted-ctfidf-v1", generatedAt: new Date().toISOString(), documentCount: documents.length, topicCount: topics.length, topics, assignments, hierarchy: hierarchy(topics, Number(options.hierarchyThreshold ?? 0.18)), drift: detectDrift(documents), options: { similarityThreshold: threshold, hierarchyThreshold: Number(options.hierarchyThreshold ?? 0.18), halfLifeDays } };
}
