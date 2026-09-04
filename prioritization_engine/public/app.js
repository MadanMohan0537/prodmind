import { prioritize } from "./engine.js";

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

const sample = [
  { id: "onboarding", title: "Interactive onboarding checklist", businessValue: 8, userValue: 9, strategicAlignment: 9, confidence: .84, feasibility: .82, urgency: 8, effort: 5, risk: .18, uncertainty: .16, evidenceCount: 208, tags: ["activation"] },
  { id: "sso", title: "Enterprise SAML SSO", businessValue: 9, userValue: 7, strategicAlignment: 8, confidence: .76, feasibility: .61, urgency: 7, effort: 13, risk: .35, uncertainty: .28, evidenceCount: 64, tags: ["enterprise"] },
  { id: "exports", title: "Scheduled report exports", businessValue: 6, userValue: 8, strategicAlignment: 6, confidence: .79, feasibility: .9, urgency: 6, effort: 3, risk: .12, uncertainty: .14, evidenceCount: 91, tags: ["reporting"] },
  { id: "api", title: "Public reporting API", businessValue: 8, userValue: 7, strategicAlignment: 8, confidence: .65, feasibility: .68, urgency: 5, effort: 8, risk: .3, uncertainty: .3, evidenceCount: 43, dependencies: ["exports"], tags: ["platform"] },
  { id: "themes", title: "Custom dashboard themes", businessValue: 3, userValue: 5, strategicAlignment: 3, confidence: .55, feasibility: .92, urgency: 2, effort: 2, risk: .08, uncertainty: .2, evidenceCount: 17, tags: ["experience"] }
];

function render(result) {
  byId("total").textContent = result.ranked.length;
  byId("pareto").textContent = result.paretoFrontier.length;
  byId("used").textContent = result.portfolio.used;
  byId("capacityLabel").textContent = `of ${result.portfolio.capacity}`;
  byId("selected").textContent = result.portfolio.selected.length;
  byId("remaining").textContent = `${result.portfolio.remaining} capacity remaining`;
  const chosen = new Set(result.portfolio.selected);
  byId("portfolio").classList.remove("empty");
  byId("portfolio").innerHTML = result.portfolio.selected.map(id => {
    const item = result.ranked.find(row => row.id === id);
    return `<span class="chip">#${item.rank} ${escapeHtml(item.title)} · ${item.effort}</span>`;
  }).join("") || '<span class="empty">No combination fits this capacity.</span>';
  byId("rows").innerHTML = result.ranked.map(item => `<tr><td class="rank">${item.rank}</td><td><strong class="title">${escapeHtml(item.title)}</strong><span class="sub">${item.evidenceCount} evidence · ${escapeHtml(item.owner)}</span></td><td class="range"><div class="range-track"><div class="range-band" style="margin-left:${item.uncertaintyBand.p10}%;width:${Math.max(2, item.uncertaintyBand.p90 - item.uncertaintyBand.p10)}%"></div></div><div class="range-labels"><span>${item.uncertaintyBand.p10}</span><b>${item.uncertaintyBand.p50}</b><span>${item.uncertaintyBand.p90}</span></div></td><td>${item.effort}</td><td>${item.paretoOptimal ? '<span class="badge pareto">Pareto frontier</span>' : ""}${chosen.has(item.id) ? '<span class="badge pareto">Selected</span>' : ""}${item.blockedBy.length ? `<span class="badge blocked">Missing: ${escapeHtml(item.blockedBy.join(", "))}</span>` : ""}<span class="sub">${escapeHtml(item.explanation)}</span></td></tr>`).join("");
}

function run() {
  try {
    const parsed = JSON.parse(byId("input").value);
    const opportunities = Array.isArray(parsed) ? parsed : parsed.opportunities;
    const result = prioritize(opportunities, { capacity: Number(byId("capacity").value), iterations: 1000, seed: 42 });
    byId("count").textContent = `${opportunities.length} items`;
    byId("error").textContent = "";
    render(result);
  } catch (error) { byId("error").textContent = error.message; }
}

byId("sample").addEventListener("click", () => { byId("input").value = JSON.stringify(sample, null, 2); run(); });
byId("run").addEventListener("click", run);
