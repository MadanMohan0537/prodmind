const form = document.querySelector("#control");
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
  message.textContent = "Reconciling estimate bases…";
  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000) throw new Error("Choose a JSON file under 2 MB.");
    const response = await fetch("/api/roadmap-estimate-adoption", {
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
    for (const [label, value] of Object.entries({
      Status: report.status,
      Items: report.summary.scheduledItems,
      Compliant: report.summary.compliantItems,
      Exceptions: report.summary.exceptionItems,
    })) {
      const card = element("article", undefined, "metric");
      card.append(element("strong", String(value)), element("span", label));
      metrics.append(card);
    }
    const list = element("div", undefined, "application-list");
    for (const item of report.applications) {
      const card = element("article", undefined, "application-card");
      card.append(
        element("h3", item.title),
        element("p", `${item.referenceClass} · duration ×${item.appliedDurationFactor}/${item.recommendedDurationFactor ?? "unavailable"} · capacity ×${item.appliedCapacityFactor}/${item.recommendedCapacityFactor ?? "unavailable"}`),
        element("span", item.exception ? "Independent exception recorded" : "Adopted factors applied", "badge"),
      );
      list.append(card);
    }
    const details = element("details");
    details.append(
      element("summary", "Inspect applications, lineage, exceptions, checks, policy, and review"),
      element("pre", JSON.stringify(report, null, 2)),
    );
    results.append(metrics, list, element("p", report.method, "method"), details);
    message.textContent = "Estimate basis evaluated. No estimate or schedule was changed.";
  } catch (error) {
    message.textContent = error.message;
  }
});
