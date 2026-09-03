import { buildDashboard, parseJsonInput } from "./analytics.js";

const byId = id => document.getElementById(id);
let records = [];

const sample = [
  { id: "f-1", timestamp: "2026-08-25T10:00:00Z", source: "interview", segment: "New SMB", customerId: "c-1", text: "Setup was easy, but inviting my team was confusing.", sentiment: -0.2, topics: ["onboarding", "collaboration"], intents: ["complaint"] },
  { id: "f-2", timestamp: "2026-08-26T12:00:00Z", source: "support", segment: "New SMB", customerId: "c-2", text: "Please add an onboarding checklist.", sentiment: -0.4, topics: ["onboarding"], intents: ["feature-request"] },
  { id: "f-3", timestamp: "2026-08-27T14:00:00Z", source: "survey", segment: "Enterprise", customerId: "c-3", text: "Reporting is fast and useful.", sentiment: 0.8, topics: ["reporting"], intents: ["praise"] },
  { id: "f-4", timestamp: "2026-08-28T09:00:00Z", source: "support", segment: "Enterprise", customerId: "c-4", text: "The export fails for large reports.", sentiment: -0.8, topics: ["reporting", "reliability"], intents: ["bug-report"] },
  { id: "f-5", timestamp: "2026-08-29T11:00:00Z", source: "app-review", segment: "Individual", customerId: "c-5", text: "Love the mobile experience.", sentiment: 0.9, topics: ["mobile"], intents: ["praise"] },
  { id: "f-6", timestamp: "2026-08-30T11:00:00Z", source: "support", segment: "New SMB", customerId: "c-6", text: "I cannot find the invite button.", sentiment: -0.7, topics: ["onboarding", "collaboration"], intents: ["bug-report", "complaint"] },
  { id: "f-7", timestamp: "2026-09-01T09:00:00Z", source: "support", segment: "New SMB", customerId: "c-7", text: "Onboarding keeps sending me back to step one.", sentiment: -0.9, topics: ["onboarding", "reliability"], intents: ["bug-report"] },
  { id: "f-8", timestamp: "2026-09-01T10:00:00Z", source: "survey", segment: "New SMB", customerId: "c-8", text: "Team setup takes too long.", sentiment: -0.7, topics: ["onboarding"], intents: ["complaint"] },
  { id: "f-9", timestamp: "2026-09-01T11:00:00Z", source: "interview", segment: "New SMB", customerId: "c-9", text: "We need guided setup before we can roll this out.", sentiment: -0.6, topics: ["onboarding"], intents: ["feature-request"] },
  { id: "f-10", timestamp: "2026-09-01T12:00:00Z", source: "app-review", segment: "Individual", customerId: "c-10", text: "Account setup is broken.", sentiment: -1, topics: ["onboarding", "reliability"], intents: ["bug-report"] }
];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function populate(id, values, placeholder) {
  const select = byId(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.value = values.includes(current) ? current : "";
}

function renderBars(id, rows) {
  byId(id).innerHTML = rows.slice(0, 6).map(row => `<div class="bar-row"><span title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, row.share * 100)}%"></div></div><b>${row.count}</b></div>`).join("") || '<p class="empty">No data.</p>';
}

function render(result) {
  byId("total").textContent = result.summary.totalFeedback.toLocaleString();
  byId("customers").textContent = result.summary.uniqueCustomers.toLocaleString();
  byId("sentiment").textContent = `${result.summary.averageSentiment >= 0 ? "+" : ""}${result.summary.averageSentiment.toFixed(2)}`;
  byId("attention").textContent = result.summary.needsAttention.toLocaleString();
  const max = Math.max(1, ...result.trends.map(row => row.volume));
  byId("trend").classList.remove("empty");
  byId("trend").innerHTML = result.trends.map(row => `<div class="trend-item"><i style="height:${Math.max(3, row.volume / max * 100)}%" data-tip="${row.volume} items · sentiment ${row.averageSentiment}"></i><span>${row.date.slice(5)}</span></div>`).join("") || "No records match these filters.";
  renderBars("topics", result.topics);
  renderBars("sources", result.sources);
  renderBars("segments", result.segments);
  byId("alertCount").textContent = `${result.anomalies.length} alert${result.anomalies.length === 1 ? "" : "s"}`;
  byId("alerts").innerHTML = result.anomalies.slice(0, 5).map(item => `<div class="alert ${item.severity}"><b>${escapeHtml(item.type.replace("-", " "))} · ${escapeHtml(item.date)}</b><span>${escapeHtml(item.message)}</span></div>`).join("") || '<p class="empty">No anomalies detected.</p>';
  byId("evidenceCount").textContent = `${result.evidence.length} shown`;
  byId("evidence").innerHTML = result.evidence.map(event => `<article class="evidence-item"><div class="evidence-meta"><span class="chip">${escapeHtml(event.source)}</span><span class="chip">${escapeHtml(event.segment)}</span>${event.topics.map(topic => `<span class="chip">${escapeHtml(topic)}</span>`).join("")}</div><p>${escapeHtml(event.text)}</p><time>${new Date(event.timestamp).toLocaleString()} · sentiment ${event.sentiment}</time></article>`).join("") || '<p class="empty">No evidence matches these filters.</p>';
}

function analyze() {
  try {
    records = parseJsonInput(byId("input").value);
    const normalized = buildDashboard(records);
    if (![byId("source"), byId("segment"), byId("topic")].some(element => element.options.length > 1)) {
      populate("source", normalized.sources.map(row => row.name), "All sources");
      populate("segment", normalized.segments.map(row => row.name), "All segments");
      populate("topic", normalized.topics.map(row => row.name).filter(name => name !== "Uncategorized"), "All topics");
    }
    render(buildDashboard(records, { source: byId("source").value, segment: byId("segment").value, topic: byId("topic").value, query: byId("query").value }));
    byId("inputCount").textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
    byId("error").textContent = "";
  } catch (error) { byId("error").textContent = error.message; }
}

byId("sample").addEventListener("click", () => { byId("input").value = JSON.stringify(sample, null, 2); [byId("source"), byId("segment"), byId("topic")].forEach(element => { element.innerHTML = element.options[0].outerHTML; }); analyze(); });
byId("analyze").addEventListener("click", analyze);
["source", "segment", "topic"].forEach(id => byId(id).addEventListener("change", analyze));
byId("query").addEventListener("input", analyze);
