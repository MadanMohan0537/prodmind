const form = document.querySelector("#verifier");
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
  message.textContent = "Verifying recovery execution and follow-up controls…";
  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000) throw new Error("Choose a JSON file under 2 MB.");
    const response = await fetch("/api/roadmap-recovery-verification", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${form.elements.token.value}`,
        "Content-Type": "application/json",
      },
      body: await file.text(),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error ?? "Request failed");
    const metrics = element("div", undefined, "metrics");
    const summary = {
      Status: report.status,
      Actions: `${report.summary.completedActions}/${report.summary.actions}`,
      Controls: `${report.summary.restoredControls}/${report.summary.originallyFailedControls}`,
      Observation: `${report.summary.observationDays}d`,
    };
    for (const [label, value] of Object.entries(summary)) {
      const card = element("article", undefined, "metric");
      card.append(element("strong", String(value)), element("span", label));
      metrics.append(card);
    }
    const details = element("details"); details.append(element("summary", "Inspect complete lineage, checks, evidence, and review"), element("pre", JSON.stringify(report, null, 2)));
    results.append(metrics, element("p", report.method, "method"), details);
    message.textContent = "Recovery evaluated. No action, baseline, or delivery state was changed.";
  } catch (error) {
    message.textContent = error.message;
  }
});
