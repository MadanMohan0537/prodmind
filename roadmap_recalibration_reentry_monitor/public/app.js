const form = document.querySelector("#assurance");
const notice = document.querySelector("#notice");
const results = document.querySelector("#results");

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  node.append(strong, span);
  return node;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice.className = "";
  notice.textContent = "Assessing…";
  results.replaceChildren();

  try {
    const file = form.elements.file.files[0];
    if (!file || file.size > 2_000_000) {
      throw new Error("Choose a JSON file under 2 MB.");
    }

    const response = await fetch("/api/roadmap-recalibration-reentry-assurance", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${form.elements.token.value}`,
        "Content-Type": "application/json",
      },
      body: await file.text(),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Request failed");

    const metrics = document.createElement("div");
    metrics.className = "metrics";
    metrics.append(
      metric("Status", payload.status),
      metric("Stages", payload.summary.stages),
      metric("Samples", payload.summary.samples),
      metric("Incidents", payload.summary.incidents),
    );

    const heading = document.createElement("h3");
    heading.textContent = `Re-entry assurance · ${payload.status}`;
    const explanation = document.createElement("p");
    explanation.className = "muted";
    explanation.textContent = payload.method;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Inspect stages, classes, controls, recurrence signals, and checks";
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(payload, null, 2);
    details.append(summary, pre);

    results.append(metrics, heading, explanation, details);
    notice.className = "ok";
    notice.textContent =
      "Assessment complete. No exposure, policy version, estimate, pause, or rollback action was changed.";
  } catch (error) {
    notice.className = "error";
    notice.textContent = error.message;
  }
});
