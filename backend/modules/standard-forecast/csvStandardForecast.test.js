import assert from 'node:assert';
import test from 'node:test';
import {
  buildNormalizedColumns,
  normalizeColumnName,
  parseDecimal,
  parseTime,
  validateHeaders,
} from './csvStandardForecast.js';

test('normalizeColumnName applies aliases', () => {
  assert.strictEqual(normalizeColumnName('Start Time'), 'start date time');
  assert.strictEqual(normalizeColumnName('Name'), 'client name');
});

test('validateHeaders requires standard columns', () => {
  const norm = buildNormalizedColumns(['Client Name', 'Day']);
  const errs = validateHeaders(new Set(norm.keys()));
  assert.ok(errs.length > 0);
  assert.match(errs[0], /Missing required columns/);
});

test('parseTime HH:MM and H:MM', () => {
  assert.strictEqual(parseTime('06:00'), '06:00');
  assert.strictEqual(parseTime('6:00'), '06:00');
  assert.strictEqual(parseTime(''), null);
  assert.strictEqual(parseTime('25:00'), null);
});

test('parseDecimal strips currency and hrs', () => {
  assert.strictEqual(parseDecimal('$120.50'), 120.5);
  assert.strictEqual(parseDecimal('4.0 hrs'), 4);
});
