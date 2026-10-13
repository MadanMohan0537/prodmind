const form = document.querySelector("#calibration");
const message = document.querySelector("#message");
const results = document.querySelector("#results");

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  results.replaceChildren();
  message.textContent = "Calibrating historical delivery evidence…";
  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000) throw new Error("Choose a JSON file under 2 MB.");
    const response = await fetch("/api/roadmap-estimate-calibration", {
      method: "POST",
      headers: { Authorization: `Bearer ${form.elements.token.value}`, "Content-Type": "application/json" },
      body: await file.text(),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error ?? "Request failed");
    const metrics = element("div", undefined, "metrics");
    for (const [label, value] of Object.entries({ Status: report.status, Cases: report.summary.cases, Items: report.summary.completedItems, Classes: `${report.summary.sufficientClasses}/${report.summary.referenceClasses}` })) {
      const card = element("article", undefined, "metric");
      card.append(element("strong", String(value)), element("span", label));
      metrics.append(card);
    }
    const list = element("div", undefined, "class-list");
    for (const group of report.referenceClasses) {
      const card = element("article", undefined, "class-card");
      card.append(element("h3", group.referenceClass), element("p", `${group.sampleSize} samples · duration ×${group.recommendedDurationFactor ?? "insufficient"} · capacity ×${group.recommendedCapacityFactor ?? "insufficient"}`));
      list.append(card);
    }
    const details = element("details");
    details.append(element("summary", "Inspect observations, lineage, checks, policy, and review"), element("pre", JSON.stringify(report, null, 2)));
    results.append(metrics, list, element("p", report.method, "method"), details);
    message.textContent = "Calibration evaluated. No schedule or estimate was changed.";
  } catch (error) {
    message.textContent = error.message;
  }
});
