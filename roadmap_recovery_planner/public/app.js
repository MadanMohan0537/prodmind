const form = document.querySelector("#planner");
const message = document.querySelector("#message");
const results = document.querySelector("#results");

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderMetrics(report) {
  const metrics = element("div", undefined, "metrics");
  const values = {
    Status: report.status,
    Coverage: `${Math.round(report.summary.coverageRate * 100)}%`,
    Selected: report.summary.selectedActions,
    Capacity: `${report.summary.selectedEffortDays}/${report.summary.capacityDays}d`,
  };
  for (const [label, value] of Object.entries(values)) {
    const card = element("article", undefined, "metric");
    card.append(element("strong", String(value)), element("span", label));
    metrics.append(card);
  }
  return metrics;
}

function renderActions(actions) {
  const list = element("div", undefined, "actions");
  for (const action of actions) {
    const card = element("article", undefined, "action");
    card.append(
      element("p", action.type.replaceAll("_", " "), "tag"),
      element("h3", action.title),
      element("p", `${action.owner} · ${action.effortDays} day(s) · due ${action.dueAt}`),
      element("p", action.exitCriteria),
    );
    list.append(card);
  }
  return list;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  results.replaceChildren();
  message.textContent = "Evaluating bounded recovery combinations…";
  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000)
      throw new Error("Choose a JSON file under 2 MB.");
    const response = await fetch("/api/roadmap-recovery", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${form.elements.token.value}`,
        "Content-Type": "application/json",
      },
      body: await file.text(),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error ?? "Request failed");
    const details = element("details");
    details.append(
      element("summary", "Inspect complete evidence and decision record"),
      element("pre", JSON.stringify(report, null, 2)),
    );
    results.append(
      renderMetrics(report),
      renderActions(report.selectedActions),
      element("p", report.method, "method"),
      details,
    );
    message.textContent = "Scenario evaluated. No source system or baseline was changed.";
  } catch (error) {
    message.textContent = error.message;
  }
});
