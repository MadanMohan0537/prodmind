import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {audit} from '../src/audit.js';
import worker from '../src/worker.js';

const fixture = () => JSON.parse(readFileSync(new URL('../examples/clean.json', import.meta.url)));
const check = (mutate, code) => {
  const data = fixture();
  mutate(data);
  const report = audit(data);
  assert.equal(report.status, 'blocked');
  assert.equal(report.aggregate, null);
  assert.ok(report.findings.some(f => f.code === code));
};
test('clean events produce unique-user binary outcomes', () => {
  assert.deepEqual(audit(fixture()).aggregate, {
    control: {visitors: 1, conversions: 0}, treatment: {visitors: 1, conversions: 1},
  });
});
test('input order does not change the result', () => {
  const data = fixture();
  assert.deepEqual(audit({...data, events: [...data.events].reverse()}), audit(data));
});
test('duplicate IDs block even identical payloads', () => check(d => d.events.push({...d.events[0]}), 'duplicate_event'));
test('crossovers block', () => check(d => d.events.push({...d.events[0], event_id: 'e4', variant: 'treatment'}), 'variant_crossover'));
test('orphan conversion blocks', () => check(d => d.events[2].user_id = 'missing', 'orphan_conversion'));
test('conversion before exposure blocks', () => check(d => d.events[2].timestamp = '2026-08-01T00:00:00.000Z', 'conversion_before_exposure'));
test('impossible calendar date blocks', () => check(d => d.events[0].timestamp = '2026-02-30T00:00:00.000Z', 'invalid_timestamp'));
test('timezone-free timestamp blocks', () => check(d => d.events[0].timestamp = '2026-09-01', 'invalid_timestamp'));
test('unknown variants block', () => check(d => d.events[0].variant = 'other', 'invalid_enum'));
test('mixed experiments block', () => check(d => d.events[0].experiment_id = 'other', 'wrong_experiment'));
test('missing identifiers block', () => check(d => delete d.events[0].user_id, 'missing_identifier'));
test('null event blocks', () => check(d => d.events.push(null), 'invalid_record'));
test('empty dataset blocks', () => check(d => d.events = [], 'empty_arm'));
test('repeated conversions count once per user', () => {
  const data = fixture();
  data.events.push({...data.events[2], event_id: 'new'});
  assert.equal(audit(data).aggregate.treatment.conversions, 1);
});
test('repeated exposures count once per user', () => {
  const data = fixture();
  data.events.push({...data.events[1], event_id: 'new'});
  assert.equal(audit(data).aggregate.treatment.visitors, 1);
});
test('invalid envelope throws', () => {
  for (const value of [null, [], {}, {experiment_id: 'x', events: Array(10001)}]) assert.throws(() => audit(value));
});
test('report does not expose raw user identifiers', () => {
  const data = fixture();
  data.events[2].user_id = 'SECRET_USER';
  assert.ok(!JSON.stringify(audit(data)).includes('SECRET_USER'));
});
const request = (body = fixture(), headers = {}) => new Request('https://example.test/api/audit', {
  method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer test', ...headers}, body: JSON.stringify(body),
});
test('API fails closed when token missing', async () => assert.equal((await worker.fetch(request(), {})).status, 503));
test('API rejects unauthorized requests', async () => assert.equal((await worker.fetch(request(), {API_TOKEN: 'different'})).status, 401));
test('API accepts authenticated valid request', async () => {
  const response = await worker.fetch(request(), {API_TOKEN: 'test'});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).status, 'pass');
});
test('API blocks invalid body type', async () => assert.equal((await worker.fetch(request(null), {API_TOKEN: 'test'})).status, 422));
test('API rejects oversized streamed body', async () => {
  const response = await worker.fetch(request({data: 'x'.repeat(2_000_001)}), {API_TOKEN: 'test'});
  assert.equal(response.status, 413);
});
test('API rejects other content types', async () => assert.equal((await worker.fetch(request({}, {'Content-Type': 'text/plain'}), {API_TOKEN: 'test'})).status, 415));
test('unknown route is 404', async () => assert.equal((await worker.fetch(new Request('https://example.test/nope'), {})).status, 404));
test('CLI demo succeeds', () => {
  const child = spawnSync(process.execPath, ['src/cli.js', 'examples/clean.json'], {encoding: 'utf8'});
  assert.equal(child.status, 0);
  assert.equal(JSON.parse(child.stdout).status, 'pass');
});
test('CLI missing filename exits 1', () => assert.equal(spawnSync(process.execPath, ['src/cli.js']).status, 1));
