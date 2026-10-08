import assert from "node:assert/strict";
import test from "node:test";
import { monitorPlanningPolicyReentry } from "../src/assurance.js";
const learning = {
  id: "learning-1",
  policyRecoveryReviewId: "recovery-1",
  policyEffectivenessReviewId: "effectiveness-1",
  rolloutId: "rollout-1",
  proposalId: "change-1",
  outcomeReviewId: "outcome-1",
  experimentId: "experiment-1",
  policyId: "policy-1",
  status: "ready_for_reentry",
  contributingConditions: [{ id: "condition-1" }],
  actions: [{ id: "action-1", priority: "p1", status: "completed" }],
  reentry: {
    owner: "Planning owner",
    baselineVersion: "1.0.0",
    scope: ["alpha"],
    startsAt: "2027-10-20T00:00:00.000Z",
  },
  review: {
    decision: "approve_reentry",
    reviewedAt: "2027-10-07T00:00:00.000Z",
  },
};
const report = {
  schemaVersion: "1.0.0",
  asOf: "2027-10-14T00:00:00.000Z",
  incidentLearningReviews: [learning],
};
const monitors = [
  {
    id: "recurrence-1",
    type: "recurrence",
    sourceId: "condition-1",
    name: "Unsafe combination recurrence",
    direction: "above",
    threshold: 0,
  },
  {
    id: "guardrail-1",
    type: "guardrail",
    sourceId: "planning-latency",
    name: "Planning latency",
    direction: "above",
    threshold: 10,
  },
];
const observation = (id, observedAt) => ({
  id,
  observedAt,
  sampleSize: 100,
  metrics: [
    {
      monitorId: "recurrence-1",
      value: 0,
      evidence: "No invalid combinations in the validation trace.",
    },
    {
      monitorId: "guardrail-1",
      value: 6,
      evidence: "Planning latency export.",
    },
  ],
  actionControls: [
    {
      actionId: "action-1",
      operational: true,
      evidence: "Preflight validator log.",
    },
  ],
});
const trial = {
  id: "assurance-1",
  incidentLearningReviewId: "learning-1",
  declaredAt: "2027-10-10T00:00:00Z",
  owner: "Planning owner",
  baselineVersion: "1.0.0",
  scope: ["alpha"],
  startedAt: "2027-10-20T00:00:00Z",
  endedAt: "2027-10-22T00:00:00Z",
  monitors,
  plannedStages: [
    { id: "stage-1", exposurePercent: 5, minimumHours: 12 },
    { id: "stage-2", exposurePercent: 20, minimumHours: 12 },
  ],
  executions: [
    {
      stageId: "stage-1",
      exposurePercent: 5,
      startedAt: "2027-10-20T00:00:00Z",
      endedAt: "2027-10-21T00:00:00Z",
      evidence: "Five-percent routing record.",
      observations: [observation("observation-1", "2027-10-20T12:00:00Z")],
    },
    {
      stageId: "stage-2",
      exposurePercent: 20,
      startedAt: "2027-10-21T00:00:00Z",
      endedAt: "2027-10-22T00:00:00Z",
      evidence: "Twenty-percent routing record.",
      observations: [observation("observation-2", "2027-10-21T12:00:00Z")],
    },
  ],
  review: {
    reviewer: "Independent operations council",
    decision: "continue",
    rationale:
      "The bounded re-entry followed its declaration with stable controls.",
    reviewedAt: "2027-10-22T00:00:00Z",
  },
};
const input = (overrides) => ({
  asOf: "2027-10-22T00:00:00Z",
  minimumObservationHours: 24,
  maximumStageGapHours: 1,
  maximumExposurePercent: 20,
  minimumSampleSize: 50,
  trials: [{ ...trial, ...overrides }],
});
test("verifies a bounded re-entry with complete lineage", () => {
  const result = monitorPlanningPolicyReentry([], report, input());
  assert.equal(result.status, "verified_reentry");
  assert.deepEqual(result.sourceIncidentLearningReviewIds, ["learning-1"]);
  assert.ok(
    result.reentryAssuranceTrials[0].checks.every((item) => item.passed),
  );
});
test("blocks a Project 38 review that was not ready", () => {
  const changed = {
    ...report,
    incidentLearningReviews: [{ ...learning, status: "blocked_reentry" }],
  };
  assert.equal(
    monitorPlanningPolicyReentry([], changed, input()).status,
    "blocked_continue",
  );
});
test("requires declaration before exposure", () =>
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        input({ declaredAt: "2027-10-21T00:00:00Z" }),
      ),
    /declaration/,
  ));
test("enforces approved owner, baseline, and scope", () => {
  assert.equal(
    monitorPlanningPolicyReentry(
      [],
      report,
      input({ owner: "Different owner" }),
    ).status,
    "blocked_continue",
  );
  assert.equal(
    monitorPlanningPolicyReentry(
      [],
      report,
      input({ baselineVersion: "2.0.0" }),
    ).status,
    "blocked_continue",
  );
  assert.throws(
    () => monitorPlanningPolicyReentry([], report, input({ scope: ["beta"] })),
    /subset/,
  );
});
test("rejects missing recurrence coverage", () =>
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        input({ monitors: [monitors[1]] }),
      ),
    /2–20|recurrence/,
  ));
test("requires a guardrail monitor", () =>
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        input({
          monitors: [monitors[0], { ...monitors[0], id: "recurrence-2" }],
        }),
      ),
    /guardrail/,
  ));
test("enforces stage sequence and exposure bounds", () => {
  const executions = trial.executions.map((item, index) =>
    index ? { ...item, exposurePercent: 25 } : item,
  );
  assert.equal(
    monitorPlanningPolicyReentry([], report, input({ executions })).status,
    "blocked_continue",
  );
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        input({
          plannedStages: [trial.plannedStages[1], trial.plannedStages[0]],
        }),
      ),
    /increase/,
  );
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        {
          ...input({ endedAt: "2027-10-23T00:00:00Z" }),
          asOf: "2027-10-23T00:00:00Z",
        },
      ),
    /final stage/,
  );
});
test("blocks insufficient stage dwell", () => {
  const executions = trial.executions.map((item, index) =>
    index
      ? {
          ...item,
          endedAt: "2027-10-21T06:00:00Z",
          observations: [observation("observation-2", "2027-10-21T03:00:00Z")],
        }
      : item,
  );
  assert.equal(
    monitorPlanningPolicyReentry(
      [],
      report,
      input({ executions, endedAt: "2027-10-21T06:00:00Z" }),
    ).status,
    "blocked_continue",
  );
});
test("blocks an immature observation window", () =>
  assert.equal(
    monitorPlanningPolicyReentry([], report, {
      ...input(),
      minimumObservationHours: 72,
    }).status,
    "blocked_continue",
  ));
test("blocks insufficient samples", () => {
  const executions = structuredClone(trial.executions);
  executions[0].observations[0].sampleSize = 10;
  assert.equal(
    monitorPlanningPolicyReentry([], report, input({ executions })).status,
    "blocked_continue",
  );
});
test("blocks a failed critical action control", () => {
  const executions = structuredClone(trial.executions);
  executions[1].observations[0].actionControls[0].operational = false;
  assert.equal(
    monitorPlanningPolicyReentry([], report, input({ executions })).status,
    "blocked_continue",
  );
});
test("blocks recurrence and guardrail breaches", () => {
  for (const monitorId of ["recurrence-1", "guardrail-1"]) {
    const executions = structuredClone(trial.executions);
    executions[0].observations[0].metrics.find(
      (item) => item.monitorId === monitorId,
    ).value = 11;
    assert.equal(
      monitorPlanningPolicyReentry([], report, input({ executions })).status,
      "blocked_continue",
    );
  }
});
test("keeps pause and refreeze human controlled", () => {
  for (const decision of ["pause", "refreeze"])
    assert.equal(
      monitorPlanningPolicyReentry(
        [],
        report,
        input({ review: { ...trial.review, decision } }),
      ).status,
      "action_required",
    );
});
test("rejects incomplete observations and duplicate identities", () => {
  const executions = structuredClone(trial.executions);
  executions[0].observations[0].metrics.pop();
  assert.throws(
    () => monitorPlanningPolicyReentry([], report, input({ executions })),
    /every declared monitor/,
  );
  assert.throws(
    () =>
      monitorPlanningPolicyReentry([], report, {
        ...input(),
        trials: [trial, trial],
      }),
    /IDs must be unique/,
  );
});
test("rejects malformed reports, unknown reviews, and invalid bounds", () => {
  assert.throws(
    () => monitorPlanningPolicyReentry([], {}, input()),
    /Project 38/,
  );
  assert.throws(
    () =>
      monitorPlanningPolicyReentry(
        [],
        report,
        input({ incidentLearningReviewId: "missing" }),
      ),
    /Project 38/,
  );
  assert.throws(
    () =>
      monitorPlanningPolicyReentry([], report, {
        ...input(),
        minimumObservationHours: 0,
      }),
    /1 to 720/,
  );
});
