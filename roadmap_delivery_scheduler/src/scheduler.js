const DAY = 86_400_000;

function required(value, name, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${name} must contain 1–${max} characters`);
  return value.trim();
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function isoDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${name} must be an ISO date`);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${name} must be a real ISO date`);
  return value;
}

function timestamp(value, name) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error(`${name} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

const toDay = (date) => Math.floor(Date.parse(`${date}T00:00:00.000Z`) / DAY);
const fromDay = (day) => new Date(day * DAY).toISOString().slice(0, 10);

function normalizeTeams(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20)
    throw new Error("Provide 1–20 delivery teams");
  const ids = new Set();
  return raw.map((item, index) => {
    const id = required(item.id, `Team ${index + 1} id`, 80);
    if (ids.has(id)) throw new Error("Team IDs must be unique");
    ids.add(id);
    const nonWorkingDates = (item.nonWorkingDates ?? []).map(
      (value, dateIndex) =>
        isoDate(value, `${id} nonWorkingDates ${dateIndex + 1}`),
    );
    if (new Set(nonWorkingDates).size !== nonWorkingDates.length)
      throw new Error(`${id} non-working dates must be unique`);
    return {
      id,
      name: required(item.name, `${id} name`, 160),
      capacity: integer(item.capacity, `${id} capacity`, 1, 20),
      nonWorkingDates,
    };
  });
}

function normalizeCalendar(input) {
  const horizonStart = isoDate(input.horizonStart, "horizonStart");
  const maximumHorizonDays = integer(
    input.maximumHorizonDays,
    "maximumHorizonDays",
    7,
    730,
  );
  if (!Array.isArray(input.workingWeekdays) || !input.workingWeekdays.length)
    throw new Error("Provide workingWeekdays");
  const workingWeekdays = input.workingWeekdays.map((value, index) =>
    integer(value, `workingWeekdays ${index + 1}`, 0, 6),
  );
  if (new Set(workingWeekdays).size !== workingWeekdays.length)
    throw new Error("workingWeekdays must be unique");
  const nonWorkingDates = (input.nonWorkingDates ?? []).map((value, index) =>
    isoDate(value, `nonWorkingDates ${index + 1}`),
  );
  if (new Set(nonWorkingDates).size !== nonWorkingDates.length)
    throw new Error("nonWorkingDates must be unique");
  return {
    horizonStart,
    horizonDay: toDay(horizonStart),
    maximumHorizonDays,
    workingWeekdays: new Set(workingWeekdays),
    nonWorkingDates: new Set(nonWorkingDates),
  };
}

function normalizePlans(portfolio, raw, teams, calendar) {
  if (!Array.isArray(portfolio.selected) || !portfolio.selected.length)
    throw new Error("Project 14 portfolio must contain selected items");
  if (portfolio.selected.length > 8)
    throw new Error("At most 8 selected items can be scheduled exactly");
  if (!Array.isArray(raw) || raw.length !== portfolio.selected.length)
    throw new Error(
      "Provide exactly one delivery plan for every selected portfolio item",
    );
  const selected = new Map(
    portfolio.selected.map((item) => [item.portfolioItemId, item]),
  );
  if (selected.size !== portfolio.selected.length)
    throw new Error("Selected portfolio item IDs must be unique");
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const seen = new Set();
  const plans = raw.map((item, index) => {
    const portfolioItemId = required(
      item.portfolioItemId,
      `Plan ${index + 1} portfolioItemId`,
      240,
    );
    if (!selected.has(portfolioItemId))
      throw new Error(`Unknown selected portfolio item: ${portfolioItemId}`);
    if (seen.has(portfolioItemId))
      throw new Error("Delivery plan portfolioItemIds must be unique");
    seen.add(portfolioItemId);
    const teamId = required(item.teamId, `${portfolioItemId} teamId`, 80);
    const team = teamMap.get(teamId);
    if (!team) throw new Error(`${portfolioItemId} references an unknown team`);
    const earliestStart = isoDate(
      item.earliestStart,
      `${portfolioItemId} earliestStart`,
    );
    const deadline = isoDate(item.deadline, `${portfolioItemId} deadline`);
    const earliestIndex = toDay(earliestStart) - calendar.horizonDay;
    const deadlineIndex = toDay(deadline) - calendar.horizonDay;
    if (
      earliestIndex < 0 ||
      deadlineIndex < earliestIndex ||
      deadlineIndex >= calendar.maximumHorizonDays
    )
      throw new Error(
        `${portfolioItemId} dates must fit the scheduling horizon`,
      );
    const capacity = integer(
      item.capacity,
      `${portfolioItemId} capacity`,
      1,
      20,
    );
    if (capacity > team.capacity)
      throw new Error(`${portfolioItemId} exceeds ${teamId} capacity`);
    const source = selected.get(portfolioItemId);
    if (!Array.isArray(source.dependencies) || source.dependencies.length > 8)
      throw new Error(
        `${portfolioItemId} dependencies must be an array of at most 8 IDs`,
      );
    const dependencies = source.dependencies.map((value, dependencyIndex) =>
      required(
        value,
        `${portfolioItemId} dependency ${dependencyIndex + 1}`,
        240,
      ),
    );
    if (
      !Array.isArray(source.evidenceIds) ||
      !source.evidenceIds.length ||
      source.evidenceIds.length > 200
    )
      throw new Error(`${portfolioItemId} must retain 1–200 evidence IDs`);
    const evidenceIds = source.evidenceIds.map((value, evidenceIndex) =>
      required(value, `${portfolioItemId} evidence ${evidenceIndex + 1}`, 240),
    );
    if (new Set(evidenceIds).size !== evidenceIds.length)
      throw new Error(`${portfolioItemId} evidence IDs must be unique`);
    return {
      portfolioItemId,
      runId: required(source.runId, `${portfolioItemId} runId`, 120),
      opportunityId: required(
        source.opportunityId,
        `${portfolioItemId} opportunityId`,
        120,
      ),
      title: required(source.title, `${portfolioItemId} title`, 240),
      score: source.score,
      effort: source.effort,
      evidenceIds,
      dependencies: [...new Set(dependencies)],
      teamId,
      durationDays: integer(
        item.durationDays,
        `${portfolioItemId} durationDays`,
        1,
        180,
      ),
      capacity,
      earliestStart,
      earliestIndex,
      deadline,
      deadlineIndex,
      owner: required(item.owner, `${portfolioItemId} owner`, 120),
      outcome: required(item.outcome, `${portfolioItemId} outcome`, 500),
      estimateBasis: required(
        item.estimateBasis,
        `${portfolioItemId} estimateBasis`,
        1000,
      ),
    };
  });
  const planIds = new Set(plans.map((item) => item.portfolioItemId));
  for (const plan of plans)
    for (const dependency of plan.dependencies)
      if (!planIds.has(dependency))
        throw new Error(
          `${plan.portfolioItemId} has an unscheduled dependency: ${dependency}`,
        );
  return plans;
}

function assertAcyclic(plans) {
  const map = new Map(plans.map((item) => [item.portfolioItemId, item]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id))
      throw new Error("Portfolio dependencies must be acyclic");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of map.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const plan of plans) visit(plan.portfolioItemId);
}

function workday(dayIndex, team, calendar) {
  const date = fromDay(calendar.horizonDay + dayIndex);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return (
    calendar.workingWeekdays.has(weekday) &&
    !calendar.nonWorkingDates.has(date) &&
    !team.nonWorkingDates.includes(date)
  );
}

function place(plan, readyIndex, team, load, calendar) {
  for (
    let candidate = readyIndex;
    candidate < calendar.maximumHorizonDays;
    candidate++
  ) {
    const days = [];
    for (
      let day = candidate;
      day < calendar.maximumHorizonDays && days.length < plan.durationDays;
      day++
    ) {
      if (!workday(day, team, calendar)) continue;
      if ((load[day] ?? 0) + plan.capacity > team.capacity) {
        days.length = 0;
        break;
      }
      days.push(day);
    }
    if (days.length === plan.durationDays)
      return { startIndex: days[0], finishIndex: days.at(-1), workdays: days };
  }
  return null;
}

function scheduleOrder(order, planMap, teamMap, calendar) {
  const loads = new Map(
    [...teamMap].map(([id]) => [
      id,
      Array(calendar.maximumHorizonDays).fill(0),
    ]),
  );
  const placements = new Map();
  for (const id of order) {
    const plan = planMap.get(id);
    const readyIndex = Math.max(
      plan.earliestIndex,
      ...plan.dependencies.map(
        (dependency) => placements.get(dependency).finishIndex + 1,
      ),
    );
    const team = teamMap.get(plan.teamId);
    const placement = place(
      plan,
      readyIndex,
      team,
      loads.get(plan.teamId),
      calendar,
    );
    if (!placement) return null;
    for (const day of placement.workdays)
      loads.get(plan.teamId)[day] += plan.capacity;
    placements.set(id, placement);
  }
  const rows = order.map((id) => {
    const plan = planMap.get(id);
    const placement = placements.get(id);
    const latenessDays = Math.max(
      0,
      placement.finishIndex - plan.deadlineIndex,
    );
    return {
      ...plan,
      start: fromDay(calendar.horizonDay + placement.startIndex),
      finish: fromDay(calendar.horizonDay + placement.finishIndex),
      startIndex: placement.startIndex,
      finishIndex: placement.finishIndex,
      workDates: placement.workdays.map((day) =>
        fromDay(calendar.horizonDay + day),
      ),
      deadlineMet: latenessDays === 0,
      latenessDays,
      deadlineBufferDays: plan.deadlineIndex - placement.finishIndex,
    };
  });
  return {
    order,
    rows,
    missedDeadlines: rows.filter((item) => !item.deadlineMet).length,
    totalLatenessDays: rows.reduce((sum, item) => sum + item.latenessDays, 0),
    makespanIndex: Math.max(...rows.map((item) => item.finishIndex)),
  };
}

function better(left, right) {
  if (!right) return true;
  const a = [left.missedDeadlines, left.totalLatenessDays, left.makespanIndex];
  const b = [
    right.missedDeadlines,
    right.totalLatenessDays,
    right.makespanIndex,
  ];
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] < b[index];
  }
  return left.order.join("\u0000") < right.order.join("\u0000");
}

function optimize(plans, teams, calendar) {
  const planMap = new Map(plans.map((item) => [item.portfolioItemId, item]));
  const teamMap = new Map(teams.map((item) => [item.id, item]));
  let best = null;
  let combinationsEvaluated = 0;
  const complete = new Set();
  function search(order) {
    if (order.length === plans.length) {
      const candidate = scheduleOrder(order, planMap, teamMap, calendar);
      combinationsEvaluated++;
      if (candidate && better(candidate, best)) best = candidate;
      return;
    }
    const available = plans
      .filter(
        (item) =>
          !complete.has(item.portfolioItemId) &&
          item.dependencies.every((dependency) => complete.has(dependency)),
      )
      .sort(
        (a, b) =>
          a.deadlineIndex - b.deadlineIndex ||
          a.portfolioItemId.localeCompare(b.portfolioItemId),
      );
    for (const item of available) {
      complete.add(item.portfolioItemId);
      search([...order, item.portfolioItemId]);
      complete.delete(item.portfolioItemId);
    }
  }
  search([]);
  return { best, combinationsEvaluated };
}

function dependencyCriticalPath(plans) {
  const map = new Map(plans.map((item) => [item.portfolioItemId, item]));
  const memo = new Map();
  function earliestFinish(id) {
    if (memo.has(id)) return memo.get(id);
    const item = map.get(id);
    const start = item.dependencies.length
      ? Math.max(...item.dependencies.map(earliestFinish))
      : 0;
    const finish = start + item.durationDays;
    memo.set(id, finish);
    return finish;
  }
  const projectDuration = Math.max(
    ...plans.map((item) => earliestFinish(item.portfolioItemId)),
  );
  const successors = new Map(plans.map((item) => [item.portfolioItemId, []]));
  for (const item of plans)
    for (const dependency of item.dependencies)
      successors.get(dependency).push(item.portfolioItemId);
  const latestFinishMemo = new Map();
  function latestFinish(id) {
    if (latestFinishMemo.has(id)) return latestFinishMemo.get(id);
    const next = successors.get(id);
    const value = next.length
      ? Math.min(
          ...next.map(
            (successor) =>
              latestFinish(successor) - map.get(successor).durationDays,
          ),
        )
      : projectDuration;
    latestFinishMemo.set(id, value);
    return value;
  }
  const activities = plans.map((item) => {
    const finish = earliestFinish(item.portfolioItemId);
    const earliestStartDay = finish - item.durationDays;
    const latestFinishDay = latestFinish(item.portfolioItemId);
    const totalFloatDays =
      latestFinishDay - item.durationDays - earliestStartDay;
    return {
      portfolioItemId: item.portfolioItemId,
      earliestStartDay,
      earliestFinishDay: finish,
      latestFinishDay,
      totalFloatDays,
      critical: totalFloatDays === 0,
    };
  });
  return {
    projectDurationDays: projectDuration,
    criticalPortfolioItemIds: activities
      .filter((item) => item.critical)
      .map((item) => item.portfolioItemId),
    activities,
    limitation:
      "Dependency-only critical path and total float; resource contention, calendars, and duration uncertainty are excluded.",
  };
}

export function scheduleRoadmap(runs, portfolioReport, input = {}) {
  if (!Array.isArray(runs) || runs.length > 50)
    throw new Error("Provide an array of at most 50 product runs");
  if (portfolioReport?.schemaVersion !== "1.1.0")
    throw new Error("Provide a Project 14 portfolio rebalancing report");
  const id = required(input.id, "roadmap schedule id", 80);
  const asOf = timestamp(input.asOf, "asOf");
  const calendar = normalizeCalendar(input);
  if (toDay(calendar.horizonStart) < Math.floor(Date.parse(asOf) / DAY))
    throw new Error("horizonStart cannot precede asOf");
  const teams = normalizeTeams(input.teams);
  const plans = normalizePlans(portfolioReport, input.plans, teams, calendar);
  assertAcyclic(plans);
  const { best, combinationsEvaluated } = optimize(plans, teams, calendar);
  if (!best)
    throw new Error(
      "No feasible schedule fits the declared horizon and calendars",
    );
  const reviewedAt = timestamp(input.review?.reviewedAt, "review reviewedAt");
  if (Date.parse(reviewedAt) > Date.parse(asOf))
    throw new Error("review cannot occur after asOf");
  const decision = required(input.review?.decision, "review decision", 20);
  if (!["approve", "revise", "defer"].includes(decision))
    throw new Error("review decision is invalid");
  const checks = [
    {
      id: "aligned-portfolio",
      passed: portfolioReport.status === "aligned",
      detail: "Project 14 must provide an aligned portfolio.",
    },
    {
      id: "deadline-feasibility",
      passed: best.missedDeadlines === 0,
      detail: `${best.missedDeadlines} deadline(s) missed with ${best.totalLatenessDays} total late day(s).`,
    },
    {
      id: "dependency-completeness",
      passed: best.rows.every((item) =>
        item.dependencies.every(
          (dependency) =>
            best.rows.find(
              (candidate) => candidate.portfolioItemId === dependency,
            ).finishIndex < item.startIndex,
        ),
      ),
      detail: "Every dependency finishes before its successor starts.",
    },
    {
      id: "evidence-lineage",
      passed: best.rows.every((item) => item.evidenceIds.length > 0),
      detail: "Every scheduled item retains source customer-evidence IDs.",
    },
  ];
  const allPassed = checks.every((item) => item.passed);
  const status =
    decision === "approve"
      ? allPassed
        ? "approved_schedule"
        : "blocked_approval"
      : "action_required";
  const teamSummary = teams.map((team) => {
    const items = best.rows.filter((item) => item.teamId === team.id);
    const usedCapacityDays = items.reduce(
      (sum, item) => sum + item.durationDays * item.capacity,
      0,
    );
    const availableCapacityDays = Array.from(
      { length: best.makespanIndex + 1 },
      (_, day) => (workday(day, team, calendar) ? team.capacity : 0),
    ).reduce((sum, value) => sum + value, 0);
    return {
      teamId: team.id,
      name: team.name,
      itemCount: items.length,
      usedCapacityDays,
      availableCapacityDays,
      utilizationRate: availableCapacityDays
        ? Number((usedCapacityDays / availableCapacityDays).toFixed(4))
        : 0,
    };
  });
  return {
    schemaVersion: "1.0.0",
    id,
    asOf,
    sourcePortfolioStatus: portfolioReport.status,
    sourcePortfolioItemIds: plans.map((item) => item.portfolioItemId),
    status,
    summary: {
      items: best.rows.length,
      teams: teams.length,
      start: best.rows.reduce(
        (min, item) => (item.start < min ? item.start : min),
        best.rows[0].start,
      ),
      finish: fromDay(calendar.horizonDay + best.makespanIndex),
      missedDeadlines: best.missedDeadlines,
      totalLatenessDays: best.totalLatenessDays,
      combinationsEvaluated,
      optimalWithinBounds: true,
    },
    checks,
    schedule: best.rows.map(
      ({ startIndex, finishIndex, earliestIndex, deadlineIndex, ...item }) =>
        item,
    ),
    teamSummary,
    dependencyCriticalPath: dependencyCriticalPath(plans),
    review: {
      reviewer: required(input.review?.reviewer, "review reviewer", 120),
      decision,
      rationale: required(input.review?.rationale, "review rationale", 1000),
      reviewedAt,
    },
    method:
      "exact bounded enumeration of dependency-valid priority orders with deterministic earliest feasible placement across declared calendars and team capacity; objective minimizes missed deadlines, then total lateness, then makespan; it does not assign people, change a roadmap, estimate durations, predict delivery probability, or perform schedule risk analysis",
  };
}
