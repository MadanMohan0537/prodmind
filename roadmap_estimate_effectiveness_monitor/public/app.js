const sample = {
  runs: [],
  scheduleReport: {
    schemaVersion: "1.0.0",
    id: "schedule-demo",
    asOf: "2027-02-01T00:00:00Z",
    status: "approved_schedule",
    schedule: [{
      portfolioItemId: "run:onboarding",
      title: "Improve onboarding",
      durationDays: 12,
      capacity: 2,
      evidenceIds: ["feedback-138"],
    }],
  },
  deliveryReport: {
    schemaVersion: "1.0.0",
    id: "delivery-demo",
    asOf: "2027-02-28T00:00:00Z",
    sourceScheduleId: "schedule-demo",
    items: [{
      portfolioItemId: "run:onboarding",
      status: "completed",
      actualStart: "2027-02-02T00:00:00Z",
      actualFinish: "2027-02-20T00:00:00Z",
      actualCapacityDays: 24,
    }],
  },
  adoptionReport: {
    schemaVersion: "1.0.0",
    id: "adoption-demo",
    asOf: "2027-02-01T12:00:00Z",
    status: "approved_estimate_basis",
    sourceScheduleId: "schedule-demo",
    applications: [{
      portfolioItemId: "run:onboarding",
      referenceClass: "onboarding",
      baseDurationDays: 6,
      baseCapacityDays: 20,
      scheduledDurationDays: 12,
      scheduledCapacityDays: 24,
      exception: null,
      evidenceIds: ["feedback-138"],
    }],
  },
  input: {
    id: "effectiveness-demo",
    asOf: "2027-03-01T00:00:00Z",
    maximumDurationErrorRate: 0.2,
    maximumCapacityErrorRate: 0.2,
    minimumErrorReductionRate: 0.05,
    outcomes: [{
      portfolioItemId: "run:onboarding",
      actualDurationDays: 12,
      evidence: "Reviewed delivery record confirms twelve active workdays.",
    }],
    review: {
      reviewer: "Estimation council",
      decision: "retain",
      rationale: "The calibrated estimate improved both duration and capacity accuracy.",
      reviewedAt: "2027-03-01T01:00:00Z",
    },
  },
};

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");

document.querySelector("#evaluate").addEventListener("click", async () => {
  const token = document.querySelector("#token").value;
  status.className = "status";
  status.textContent = "Evaluating…";
  try {
    const response = await fetch("/api/roadmap-estimate-effectiveness", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sample),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "Evaluation failed");
    status.className = `status ${report.status === "verified_effectiveness" ? "good" : "bad"}`;
    status.textContent = report.status.replaceAll("_", " ");
    summary.innerHTML = [
      ["Items", report.summary.items],
      ["Duration error", percent(report.summary.meanCalibratedDurationErrorRate)],
      ["Capacity error", percent(report.summary.meanCalibratedCapacityErrorRate)],
      ["Improved", `${report.summary.improvedItems}/${report.summary.items}`],
    ].map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
    results.innerHTML = report.items.map((item) => `
      <tr>
        <td>${item.title}</td>
        <td>${percent(item.calibratedDurationErrorRate)}</td>
        <td>${percent(item.calibratedCapacityErrorRate)}</td>
        <td class="${item.withinTolerance && item.improved ? "good-text" : "bad-text"}">${item.withinTolerance && item.improved ? "Effective" : "Review"}</td>
      </tr>`).join("");
  } catch (error) {
    status.className = "status bad";
    status.textContent = error.message;
  }
});
