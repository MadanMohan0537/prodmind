const observation = (id, deliveryAsOf) => ({
  portfolioItemId: id,
  referenceClass: "onboarding",
  plannedElapsedDays: 10,
  actualElapsedDays: 14,
  plannedCapacityDays: 20,
  actualCapacityDays: 28,
  deliveryAsOf,
  evidenceIds: [`feedback-${id}`],
  deliveryEvidence: `Reviewed delivery evidence for ${id}.`,
  basis: "Comparable onboarding implementation.",
});

const approval = (reviewer, rationale, reviewedAt) => ({
  reviewer,
  decision: "approve",
  rationale,
  reviewedAt,
});

const sample = {
  activeCalibrationReport: {
    schemaVersion: "1.0.0",
    id: "calibration-active",
    asOf: "2027-01-01T00:00:00Z",
    status: "adopted_calibration",
    referenceClasses: [{
      referenceClass: "onboarding",
      sufficient: true,
      recommendedDurationFactor: 1.1,
      recommendedCapacityFactor: 1.1,
      sourceCaseIds: ["delivery-old"],
    }],
  },
  driftReport: {
    schemaVersion: "1.0.0",
    id: "drift-demo",
    asOf: "2027-02-01T00:00:00Z",
    status: "action_required",
    recalibrationCandidates: ["onboarding"],
    review: { decision: "recalibrate" },
  },
  evidenceCalibrationReport: {
    schemaVersion: "1.0.0",
    id: "calibration-evidence",
    asOf: "2027-03-01T00:00:00Z",
    observations: [
      observation("one", "2027-02-02T00:00:00Z"),
      observation("two", "2027-02-06T00:00:00Z"),
      observation("three", "2027-02-10T00:00:00Z"),
      observation("four", "2027-02-14T00:00:00Z"),
      observation("five", "2027-02-18T00:00:00Z"),
      observation("six", "2027-02-22T00:00:00Z"),
    ],
  },
  input: {
    id: "recalibration-demo",
    asOf: "2027-03-02T00:00:00Z",
    activeVersion: "estimate-policy-3",
    proposedVersion: "estimate-policy-4",
    validUntil: "2027-04-01T00:00:00Z",
    minimumTrainingItemsPerClass: 4,
    holdoutItemsPerClass: 2,
    percentileRate: 0.75,
    maximumFactorChangeRate: 0.5,
    minimumHoldoutImprovementRate: 0.05,
    maximumHoldoutErrorRate: 0.15,
    rollback: {
      targetVersion: "estimate-policy-3",
      owner: "Delivery operations",
      maximumRecoveryHours: 4,
      evidence: "Previous policy bundle remains deployable.",
    },
    approvals: {
      product: approval("Product lead", "Scope matches the detected class.", "2027-03-02T01:00:00Z"),
      engineering: approval("Engineering lead", "Version and rollback are executable.", "2027-03-02T01:05:00Z"),
      assurance: approval("Independent assurance", "The temporal holdout is separate.", "2027-03-02T01:10:00Z"),
    },
    review: {
      reviewer: "Estimation council chair",
      decision: "approve",
      rationale: "The bounded proposal improves untouched evidence and is reversible.",
      reviewedAt: "2027-03-02T02:00:00Z",
    },
  },
};

const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");
const percent = (value) => value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;

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
    const response = await fetch("/api/roadmap-recalibration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${document.querySelector("#token").value}`,
      },
      body: JSON.stringify(sample),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "Evaluation failed");
    status.className = `status ${report.status === "approved_recalibration" ? "good" : "bad"}`;
    status.textContent = report.status.replaceAll("_", " ");
    summary.replaceChildren(
      metric("Candidate classes", report.summary.candidateClasses),
      metric("Approved candidates", report.summary.approvedCandidates),
      metric("Observations", report.summary.evidenceObservations),
      metric("Proposed version", report.proposedVersion),
    );
    results.replaceChildren(...report.proposals.map((entry) => {
      const row = document.createElement("tr");
      for (const value of [
        entry.referenceClass,
        `${entry.activeDurationFactor} → ${entry.candidateDurationFactor ?? "—"}`,
        `${entry.activeCapacityFactor} → ${entry.candidateCapacityFactor ?? "—"}`,
        percent(Math.min(entry.durationImprovementRate ?? 0, entry.capacityImprovementRate ?? 0)),
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      const state = document.createElement("td");
      state.textContent = entry.passed ? "Ready" : "Blocked";
      state.className = entry.passed ? "good-text" : "bad-text";
      row.append(state);
      return row;
    }));
  } catch (error) {
    status.className = "status bad";
    status.textContent = error.message;
  }
});
