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
  assert.strictEqual(normalizeColumnName('Start  Time'), 'start date time');
  assert.strictEqual(normalizeColumnName('Cost'), 'total cost');
  assert.strictEqual(normalizeColumnName('Name'), 'client name');
});

test('validateHeaders accepts Standard Billing Report column names', () => {
  const headers = [
    'Client Name',
    'Day ',
    'Start  Time',
    'End Time',
    'Duration',
    'Cost',
    'Rate Groups',
    'Reference No',
    'Shift Type',
    'Client Type',
    'Ratio',
  ];
  const norm = buildNormalizedColumns(headers);
  const errs = validateHeaders(new Set(norm.keys()));
  assert.deepStrictEqual(errs, []);
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

test('parseTime 12-hour AM/PM with optional seconds', () => {
  assert.strictEqual(parseTime('  6:00:00 AM'), '06:00');
  assert.strictEqual(parseTime('10:00:00 PM'), '22:00');
  assert.strictEqual(parseTime('2:00:00 PM'), '14:00');
  assert.strictEqual(parseTime('12:00:00 AM'), '00:00');
  assert.strictEqual(parseTime('12:00:00 PM'), '12:00');
});

test('parseDecimal strips currency and hrs', () => {
  assert.strictEqual(parseDecimal('$120.50'), 120.5);
  assert.strictEqual(parseDecimal('4.0 hrs'), 4);
});
