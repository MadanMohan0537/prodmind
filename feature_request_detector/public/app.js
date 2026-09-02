import { detectIntents } from "./detector.js";

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const themeKey = "feature-detector.theme";

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  $("#theme").textContent = dark ? "☀" : "☾";
}

applyTheme(localStorage.getItem(themeKey) || "");
$("#theme").addEventListener("click", () => {
  const current = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(themeKey, next); applyTheme(next);
});

$("#sample").addEventListener("click", () => { $("#text").value = "I love the dashboard, but exporting reports is painfully slow. Please add scheduled CSV exports for our entire team before renewal."; });
$("#threshold").addEventListener("input", event => { $("#threshold-value").value = event.target.value; });

function render(result) {
  const intents = result.intents.length ? result.intents.map(intent => `<article class="intent"><div class="intent-head"><h3>${escapeHtml(intent.label)}</h3><b>${Math.round(intent.confidence * 100)}%</b></div><div class="meter"><i style="width:${intent.confidence * 100}%"></i></div>${intent.evidence.map(item => `<p class="evidence">“${escapeHtml(item.sentence)}”<br>${item.signals.map(signal => `<span class="signal">${escapeHtml(signal.signal)}: ${escapeHtml(signal.match)}</span>`).join("")}</p>`).join("")}</article>`).join("") : `<p>No intent crossed the selected threshold.</p>`;
  $("#result").innerHTML = `<div class="result-top"><div><p class="eyebrow">PRIMARY INTENT</p><span class="primary-label">${escapeHtml(result.primaryIntent)}</span></div>${result.needsReview ? `<span class="review">Human review</span>` : ""}</div><div class="score-grid"><div class="score"><b>${result.isFeatureRequest ? "Yes" : "No"}</b><small>Feature request</small></div><div class="score"><b>${escapeHtml(result.urgency.level)}</b><small>Urgency</small></div><div class="score"><b>${escapeHtml(result.impact.level)}</b><small>Impact</small></div></div><p><b>Request style:</b> ${escapeHtml(result.requestType || "not detected")}</p><h2>Detected intents</h2>${intents}`;
}

$("#form").addEventListener("submit", event => {
  event.preventDefault();
  try { render(detectIntents($("#text").value, { threshold: Number($("#threshold").value) })); }
  catch (error) { $("#result").textContent = error.message; }
});
