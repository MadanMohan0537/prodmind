const $ = selector => document.querySelector(selector);

const example = {
  runs: [],
  recurrenceReport: {
    schemaVersion: '1.0.0',
    surveillance: [{
      id: 'surveillance-1', exitReviewId: 'exit-1', governancePackId: 'pack-1',
      portfolioItemId: 'run-1:opportunity-1', title: 'Onboarding evidence control',
      evidenceIds: ['feedback-1'], recurrenceCount: 1,
      firstRecurrenceAt: '2027-05-01T00:00:00Z', failedChecks: ['target-stable'],
    }],
  },
  input: {
    asOf: '2027-05-10T00:00:00Z', capacity: 3, minimumCoverageRate: 1,
    candidates: [{
      id: 'improvement-1', title: 'Prevent evidence digest drift', owner: 'Platform lead',
      effort: 3, covers: ['surveillance-1'], dependencies: [], response: 'prevent',
      dueAt: '2027-06-01T00:00:00Z', successMetric: 'Three weekly snapshots show no recurrence.',
      verificationWindowDays: 30,
    }],
    review: {reviewer: 'Governance council', decision: 'approve', rationale: 'The plan covers the open recurrence within capacity.', reviewedAt: '2027-05-10T00:00:00Z'},
  },
};

function loadExample() {
  $('#payload').value = JSON.stringify(example, null, 2);
}

function render(data) {
  const metrics = [
    ['Findings', data.summary.actionableFindings], ['Candidates', data.summary.candidates],
    ['Selected', data.summary.selected], ['Risk covered', `${Math.round(data.summary.coverageRate * 100)}%`],
    ['Capacity used', `${data.usedCapacity}/${data.capacity}`],
  ];
  $('#result').innerHTML = `<div class="summary">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <article class="card"><p class="eyebrow">${data.status.replaceAll('_', ' ')}</p><h2>Selected improvement portfolio</h2>
    ${data.selectedActions.length ? `<ul>${data.selectedActions.map(action => `<li class="covered"><strong>${action.title}</strong> · ${action.owner} · ${action.effort} capacity · due ${action.dueAt.slice(0, 10)}</li>`).join('')}</ul>` : '<p>No action was selected.</p>'}
    ${data.uncoveredTargets.length ? `<p class="uncovered">Uncovered: ${data.uncoveredTargets.map(item => item.title).join(', ')}</p>` : '<p class="covered">All actionable recurrence risk is covered.</p>'}</article>`;
}

$('#sample').addEventListener('click', loadExample);
$('#run').addEventListener('click', async () => {
  try {
    $('#message').textContent = 'Optimizing…';
    const response = await fetch('/api/control-improvements', {
      method: 'POST',
      headers: {Authorization: `Bearer ${$('#token').value}`, 'Content-Type': 'application/json'},
      body: $('#payload').value,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    render(data);
    $('#message').textContent = 'Plan complete. No control or assignment was changed.';
  } catch (error) {
    $('#message').textContent = error.message;
  }
});

loadExample();

