import { modelTopics } from "./topic-modeler.js";

const $ = selector => document.querySelector(selector);
const sample = ["Please add CSV export to the analytics dashboard","We need PDF reports and scheduled dashboard exports","The mobile app crashes during login","Login is slow and sometimes the app freezes","Add SSO and stronger account security controls","Security teams require SAML single sign on"];

function render(result) {
  $("#status").textContent = `${result.model} · local`;
  $("#metrics").innerHTML = `<div class="metric"><b>${result.topicCount}</b><span>topics</span></div><div class="metric"><b>${result.documentCount}</b><span>documents</span></div><div class="metric"><b>${result.drift.score}</b><span>${result.drift.level} drift</span></div>`;
  $("#topics").classList.remove("empty");
  $("#topics").innerHTML = result.topics.map(topic => `<article class="topic"><header><h3>${topic.label}</h3><span>${topic.documentCount} docs · ${Math.round(topic.share * 100)}%</span></header><div class="bar"><i style="width:${topic.share * 100}%"></i></div><div class="chips">${topic.keywords.map(keyword => `<span class="chip">${keyword.term}</span>`).join("")}</div></article>`).join("");
  $("#hierarchy").innerHTML = `<h3>Topic hierarchy</h3>${result.hierarchy.map(group => `<div class="group"><b>${group.label}</b> → ${group.children.join(", ")}</div>`).join("")}`;
}

$("#sample").addEventListener("click", () => { $("#documents").value = sample.join("\n"); });
$("#threshold").addEventListener("input", event => { $("#threshold-output").value = event.target.value; });
$("#analyze").addEventListener("click", () => {
  try {
    $("#error").textContent = "";
    const documents = $("#documents").value.split(/\n+/).map(text => text.trim()).filter(Boolean).map((text, index) => ({ id: `browser-${index + 1}`, text, timestamp: new Date(Date.now() + index * 1000).toISOString(), source: "browser" }));
    render(modelTopics(documents, { similarityThreshold: Number($("#threshold").value), halfLifeDays: Number($("#half-life").value) }));
  } catch (error) { $("#error").textContent = error.message; }
});
