const form = document.querySelector("#review");
const notice = document.querySelector("#notice");
const results = document.querySelector("#results");

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  node.append(strong, span);
  return node;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice.className = "";
  notice.textContent = "Scheduling…";
  results.replaceChildren();
  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000)
      throw new Error("Choose a JSON file under 2 MB.");
    const response = await fetch("/api/roadmap-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${form.elements.token.value}`,
      },
      body: await file.text(),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    const metrics = document.createElement("div");
    metrics.className = "metrics";
    metrics.append(
      metric("Items", payload.summary.items),
      metric("Teams", payload.summary.teams),
      metric("Finish", payload.summary.finish),
      metric("Late", payload.summary.missedDeadlines),
    );
    const heading = document.createElement("h3");
    heading.textContent = `Schedule status · ${payload.status}`;
    const method = document.createElement("p");
    method.className = "muted";
    method.textContent = payload.method;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent =
      "Inspect dates, lineage, checks, utilization, float, and review";
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(payload, null, 2);
    details.append(summary, pre);
    results.append(metrics, heading, method, details);
    notice.className = payload.status === "approved_schedule" ? "ok" : "warn";
    notice.textContent =
      "Schedule complete. No roadmap or assignment was changed.";
  } catch (error) {
    notice.className = "error";
    notice.textContent = error.message;
  }
});
