/** Deterministic event-level quality gate. Never repairs or discards defects silently. */
export function audit(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object');
  const {experiment_id: experimentId, events} = input;
  if (typeof experimentId !== 'string' || !experimentId.trim()) throw new Error('experiment_id is required');
  if (!Array.isArray(events) || events.length > 10000) throw new Error('events must be an array of at most 10000 records');
  const findings = [];
  const flag = (code, row, message) => findings.push({code, row, message});
  const seen = new Set();
  const valid = [];
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const row = index + 1;
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      flag('invalid_record', row, 'Event must be an object');
      continue;
    }
    if (['event_id', 'user_id', 'experiment_id'].some(key => typeof event[key] !== 'string' || !event[key].trim())) {
      flag('missing_identifier', row, 'Required identifiers must be nonempty strings');
      continue;
    }
    if (event.experiment_id !== experimentId) {
      flag('wrong_experiment', row, 'Record belongs to another experiment');
      continue;
    }
    if (!['control', 'treatment'].includes(event.variant) || !['exposure', 'conversion'].includes(event.type)) {
      flag('invalid_enum', row, 'Unknown variant or event type');
      continue;
    }
    if (typeof event.timestamp !== 'string' || !timestamp.test(event.timestamp) || !Number.isFinite(Date.parse(event.timestamp)) || new Date(event.timestamp).toISOString() !== event.timestamp) {
      flag('invalid_timestamp', row, 'Use a real UTC timestamp: YYYY-MM-DDTHH:mm:ss.sssZ');
      continue;
    }
    if (seen.has(event.event_id)) {
      flag('duplicate_event', row, 'event_id is repeated, including possibly conflicting payloads');
      continue;
    }
    seen.add(event.event_id);
    valid.push({...event, row, time: Date.parse(event.timestamp)});
  }
  const exposures = new Map();
  for (const event of valid.filter(event => event.type === 'exposure')) {
    if (!exposures.has(event.user_id)) exposures.set(event.user_id, new Map());
    const arms = exposures.get(event.user_id);
    arms.set(event.variant, Math.min(arms.get(event.variant) ?? Infinity, event.time));
  }
  for (const arms of exposures.values()) {
    if (arms.size > 1) flag('variant_crossover', null, 'A user has exposure records in both variants');
  }
  const converters = {control: new Set(), treatment: new Set()};
  for (const event of valid.filter(event => event.type === 'conversion')) {
    const firstExposure = exposures.get(event.user_id)?.get(event.variant);
    if (firstExposure === undefined) flag('orphan_conversion', event.row, 'No exposure in the conversion variant');
    else if (event.time < firstExposure) flag('conversion_before_exposure', event.row, 'Conversion predates first exposure');
    else converters[event.variant].add(event.user_id);
  }
  const counts = {};
  for (const arm of ['control', 'treatment']) {
    const visitors = [...exposures.values()].filter(arms => arms.has(arm)).length;
    counts[arm] = {visitors, conversions: converters[arm].size};
    if (visitors === 0) flag('empty_arm', null, `No exposed users in ${arm}`);
  }
  const passed = findings.length === 0;
  return {
    schema_version: '1.0.0',
    experiment_id: experimentId,
    status: passed ? 'pass' : 'blocked',
    input_rows: events.length,
    checked_rows: valid.length,
    findings,
    // Block ALL export on any defect. Partial counts can mask differential data loss.
    aggregate: passed ? counts : null,
    explanation: passed
      ? 'Configured event checks passed. Statistical validity, completeness and causality remain unverified.'
      : 'Do not analyze these events yet. Fix upstream defects and rerun; no aggregate was released.',
  };
}
