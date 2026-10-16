const assessment = (id, asOf) => ({
  schemaVersion: "1.0.0",
  id,
  asOf,
  status: "verified_effectiveness",
  sourceScheduleId: `schedule-${id}`,
  sourceDeliveryId: `delivery-${id}`,
  sourceAdoptionId: `adoption-${id}`,
  items: [{
    portfolioItemId: `item-${id}`,
    referenceClass: "onboarding",
    calibratedDurationErrorRate: 0.1,
    calibratedCapacityErrorRate: 0.08,
    durationErrorReductionRate: 0.2,
    capacityErrorReductionRate: 0.15,
    exception: null,
    customerEvidenceIds: [`feedback-${id}`],
    adoptionEvidenceIds: [`estimate-${id}`],
    outcomeEvidence: `Reviewed completed-delivery evidence for ${id}.`,
  }],
});

const sample = {
  runs: [],
  project46Reports: [
    assessment("one", "2027-01-01T00:00:00Z"),
    assessment("two", "2027-01-08T00:00:00Z"),
    assessment("three", "2027-01-15T00:00:00Z"),
    assessment("four", "2027-01-22T00:00:00Z"),
  ],
  input: {
    id: "drift-demo",
    asOf: "2027-01-23T00:00:00Z",
    baselineReportCount: 2,
    recentReportCount: 2,
    minimumItemsPerClass: 2,
    maximumAssessmentGapDays: 10,
    maximumReportAgeDays: 3,
    maximumDurationErrorRate: 0.2,
    maximumCapacityErrorRate: 0.2,
    maximumErrorIncreaseRate: 0.05,
    minimumErrorReductionRate: 0.1,
    minimumClassCoverageRate: 1,
    review: {
      reviewer: "Estimation council",
      decision: "retain",
      rationale: "Accuracy and improvement remain stable across both windows.",
      reviewedAt: "2027-01-23T01:00:00Z",
    },
  },
};

const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");
const percent = (value) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

function metric(label, value) {
  const article = document.createElement("article");
  article.className = "metric";
  const caption = document.createElement("span");
  caption.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  article.append(caption, strong);
  return article;
}

document.querySelector("#evaluate").addEventListener("click", async () => {
  status.className = "status";
  status.textContent = "Evaluating…";
  try {
    const response = await fetch("/api/roadmap-estimate-drift", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${document.querySelector("#token").value}`,
      },
      body: JSON.stringify(sample),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "Evaluation failed");
    status.className = `status ${report.status === "stable_calibration" ? "good" : "bad"}`;
    status.textContent = report.status.replaceAll("_", " ");
    summary.replaceChildren(
      metric("Assessments", report.summary.reports),
      metric("Class coverage", percent(report.summary.classCoverageRate)),
      metric("Stable classes", `${report.summary.stableClasses}/${report.summary.referenceClasses}`),
      metric("Candidates", report.summary.recalibrationCandidates),
    );
    results.replaceChildren(...report.referenceClasses.map((entry) => {
      const row = document.createElement("tr");
      for (const value of [
        entry.referenceClass,
        percent(entry.durationErrorIncreaseRate),
        percent(entry.capacityErrorIncreaseRate),
        `${entry.baselineSamples}/${entry.recentSamples}`,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      const state = document.createElement("td");
      state.textContent = entry.stable ? "Stable" : "Review";
      state.className = entry.stable ? "good-text" : "bad-text";
      row.append(state);
      return row;
    }));
  } catch (error) {
    status.className = "status bad";
    status.textContent = error.message;
  }
});
