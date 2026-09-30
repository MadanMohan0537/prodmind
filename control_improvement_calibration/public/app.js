const $ = selector => document.querySelector(selector);

const example = {
  runs: [],
  outcomeReport: {
    schemaVersion: '1.0.0',
    reviews: [
      {
        id: 'outcome-1', response: 'prevent', plannedEffort: 4, actualEffort: 5,
        status: 'verified_effective', asOf: '2027-07-01T00:00:00Z', evidenceIds: ['feedback-1'],
        checks: [
          {id: 'completed-on-time', passed: true},
          {id: 'verification-window', passed: true},
          {id: 'recurrence-reduced', passed: true},
        ],
        followups: [{recurrenceCount: 0}],
      },
      {
        id: 'outcome-2', response: 'detect', plannedEffort: 6, actualEffort: 5,
        status: 'verified_effective', asOf: '2027-07-01T00:00:00Z', evidenceIds: ['feedback-2'],
        checks: [
          {id: 'completed-on-time', passed: true},
          {id: 'verification-window', passed: true},
          {id: 'recurrence-reduced', passed: true},
        ],
        followups: [{recurrenceCount: 0}],
      },
    ],
  },
  input: {
    asOf: '2027-07-02T00:00:00Z', minimumSampleSize: 2,
    maximumAbsoluteEffortBiasRate: .2, minimumOnTimeRate: 1,
    minimumEffectivenessRate: 1, maximumRecurrenceRate: 0,
    review: {
      reviewer: 'Portfolio council', decision: 'accept_baseline',
      rationale: 'The measured baseline meets the declared thresholds.',
      reviewedAt: '2027-07-02T00:00:00Z',
    },
  },
};

function load() { $('#payload').value = JSON.stringify(example, null, 2); }

function render(data) {
  const metrics = [
    ['Sample', data.portfolio.sampleSize],
    ['Effort bias', `${Math.round(data.portfolio.effortBiasRate * 100)}%`],
    ['On time', `${Math.round(data.portfolio.onTimeRate * 100)}%`],
    ['Effective', `${Math.round(data.portfolio.effectivenessRate * 100)}%`],
    ['Recurrence', `${Math.round(data.portfolio.recurrenceRate * 100)}%`],
  ];
  const cohorts = data.byResponse.map(item => `<tr><td>${item.response}</td><td>${item.sampleSize}</td><td>${item.effortBiasRate}</td><td>${item.onTimeRate}</td><td>${item.effectivenessRate}</td></tr>`).join('');
  $('#result').innerHTML = `
    <div class="summary">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`).join('')}</div>
    <article class="card">
      <p class="eyebrow">${data.status.replaceAll('_', ' ')}</p>
      <h2>Human decision: ${data.review.decision.replaceAll('_', ' ')}</h2>
      <p>Descriptive effort multiplier: <strong>${data.planningSignals.descriptiveEffortMultiplier ?? 'not available'}</strong></p>
      <ul>${data.checks.map(check => `<li class="${check.passed ? 'pass' : 'fail'}">${check.passed ? '✓' : '✕'} ${check.id}: ${check.detail}</li>`).join('')}</ul>
      <table><thead><tr><th>Response</th><th>Sample</th><th>Bias</th><th>On time</th><th>Effective</th></tr></thead><tbody>${cohorts}</tbody></table>
    </article>`;
}

$('#sample').onclick = load;
$('#run').onclick = async () => {
  try {
    $('#message').textContent = 'Calibrating…';
    const response = await fetch('/api/control-improvement-calibration', {
      method: 'POST',
      headers: {Authorization: `Bearer ${$('#token').value}`, 'Content-Type': 'application/json'},
      body: $('#payload').value,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    render(data);
    $('#message').textContent = 'Calibration complete. No estimate or plan was changed automatically.';
  } catch (error) {
    $('#message').textContent = error.message;
  }
};

load();
