import { deduplicate, normalizeRecord, parseCsv } from "./feedback.js";

const seed = [
  { text: "The dashboard is fast and easy to understand", source: "Interview", customer: "Acme" },
  { text: "Please add CSV exports for weekly reports", source: "Support", customer: "Northstar" },
  { text: "The mobile page crashes when I open filters", source: "App review", customer: "Anonymous" },
  { text: "I would like a way to merge duplicate requests", source: "Survey", customer: "Orbit" }
];

const storageKey = "feedback-collector.offline.v2";
let feedback = loadOffline();
let apiUrl = sessionStorage.getItem("feedback-collector.api-url") || "";
let apiToken = sessionStorage.getItem("feedback-collector.api-token") || "";

function loadOffline() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || seed.map(normalizeRecord); }
  catch { return seed.map(normalizeRecord); }
}

function saveOffline() {
  localStorage.setItem(storageKey, JSON.stringify(feedback));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  const counts = feedback.reduce((result, item) => ({ ...result, [item.sentiment]: (result[item.sentiment] || 0) + 1 }), {});
  document.querySelector("#total").textContent = feedback.length;
  document.querySelector("#requests").textContent = feedback.filter(item => item.intent === "feature-request").length;
  document.querySelector("#negative").textContent = counts.negative || 0;
  document.querySelector("#sources").textContent = new Set(feedback.map(item => item.source)).size;
  document.querySelector("#feedback-list").innerHTML = feedback.map(item => `
    <article class="feedback-card">
      <div class="card-top">
        <span class="tag ${item.sentiment}">${item.sentiment}</span>
        <span class="tag">${item.intent.replace("-", " ")}</span>
        ${item.confidence ? `<span class="tag">${Math.round(item.confidence * 100)}% confidence</span>` : ""}
      </div>
      <p>${escapeHtml(item.text)}</p>
      <small>${escapeHtml(item.source)} · ${escapeHtml(item.customer)}</small>
    </article>`).join("") || `<div class="empty">No feedback yet.</div>`;
}

async function api(path, options = {}) {
  if (!apiUrl || !apiToken) throw new Error("API connection is not configured");
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}`, ...options.headers }
  });
  if (!response.ok) throw new Error((await response.json()).error || `Request failed with ${response.status}`);
  return response.json();
}

async function refreshFromApi() {
  const result = await api("/api/feedback?limit=500");
  feedback = result.data.map(item => ({ ...item, createdAt: item.created_at }));
  render();
}

document.querySelector("#connection-form").addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  apiUrl = data.apiUrl.trim();
  apiToken = data.apiToken;
  sessionStorage.setItem("feedback-collector.api-url", apiUrl);
  sessionStorage.setItem("feedback-collector.api-token", apiToken);
  try {
    await refreshFromApi();
    document.querySelector("#connection-status").textContent = "Connected to the secured Worker API.";
  } catch (error) {
    document.querySelector("#connection-status").textContent = `Connection failed: ${error.message}. Offline data remains available.`;
  }
});

document.querySelector("#feedback-form").addEventListener("submit", async event => {
  event.preventDefault();
  const record = Object.fromEntries(new FormData(event.currentTarget));
  if (apiUrl && apiToken) {
    try { await api("/api/feedback", { method: "POST", body: JSON.stringify(record) }); await refreshFromApi(); }
    catch (error) { document.querySelector("#import-status").textContent = error.message; return; }
  } else {
    const item = normalizeRecord(record, feedback.length);
    if (item) feedback = deduplicate([item, ...feedback]);
    saveOffline();
    render();
  }
  event.currentTarget.reset();
});

document.querySelector("#file-input").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  let records;
  try {
    const content = await file.text();
    records = file.name.endsWith(".json") ? JSON.parse(content) : parseCsv(content);
    if (!Array.isArray(records)) records = [records];
  } catch {
    document.querySelector("#import-status").textContent = "The file could not be parsed.";
    return;
  }
  if (apiUrl && apiToken) {
    try {
      const result = await api("/api/feedback", { method: "POST", body: JSON.stringify({ source: "file-import", records }) });
      document.querySelector("#import-status").textContent = `${result.received} records accepted for processing.`;
      if (result.status === "completed") await refreshFromApi();
    } catch (error) { document.querySelector("#import-status").textContent = error.message; }
  } else {
    const before = feedback.length;
    feedback = deduplicate([...records.map(normalizeRecord).filter(Boolean), ...feedback]);
    saveOffline(); render();
    document.querySelector("#import-status").textContent = `${feedback.length - before} new offline records imported.`;
  }
  event.target.value = "";
});

document.querySelector("#reset").addEventListener("click", () => {
  feedback = seed.map(normalizeRecord);
  saveOffline(); render();
  document.querySelector("#import-status").textContent = "Offline demonstration data restored.";
});

render();
