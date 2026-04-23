import assert from 'node:assert';
import test from 'node:test';
import {
  buildNormalizedColumns,
  COLUMN_ALIASES,
  moneyEqual,
  normalizeColumnName,
  parseBoolean,
  parseDate,
  parseDateTime,
  parseDecimal,
  REQUIRED_CSV_COLUMNS,
  roundMoney,
  validateHeaders,
} from './csvForecastActuals.js';

test('normalizeColumnName applies aliases', () => {
  assert.strictEqual(normalizeColumnName('Start Time'), 'start date time');
  assert.strictEqual(normalizeColumnName('Client Name'), 'client name');
});

test('validateHeaders requires all REQUIRED_CSV_COLUMNS', () => {
  const keys = new Set([...REQUIRED_CSV_COLUMNS]);
  assert.deepStrictEqual(validateHeaders(keys), []);
  const missing = new Set(keys);
  missing.delete('cost');
  assert.ok(validateHeaders(missing)[0].includes('cost'));
});

test('parseDate: ISO and AU slash', () => {
  const d1 = parseDate('2026-04-15');
  assert.strictEqual(d1.toISOString().slice(0, 10), '2026-04-15');
  const d2 = parseDate('15/04/2026');
  assert.strictEqual(d2.toISOString().slice(0, 10), '2026-04-15');
});

test('parseDateTime: AU 24h and 12h', () => {
  const t1 = parseDateTime('15/04/2026 14:30');
  assert.strictEqual(t1.toISOString(), '2026-04-15T14:30:00.000Z');
  const t2 = parseDateTime('15/04/2026 2:30 pm');
  assert.strictEqual(t2.toISOString(), '2026-04-15T14:30:00.000Z');
});

test('parseDecimal strips currency and hrs suffix', () => {
  assert.strictEqual(parseDecimal('$1,234.50'), 1234.5);
  assert.strictEqual(parseDecimal('8.5 hrs'), 8.5);
  assert.strictEqual(parseDecimal(''), null);
});

test('parseBoolean', () => {
  assert.strictEqual(parseBoolean('yes'), true);
  assert.strictEqual(parseBoolean('No'), false);
});

test('roundMoney and moneyEqual', () => {
  assert.strictEqual(roundMoney(1.014999), 1.01);
  assert.strictEqual(roundMoney(10.125), 10.13);
  assert.strictEqual(moneyEqual(10, 10.001), true);
});

test('buildNormalizedColumns maps original headers', () => {
  const m = buildNormalizedColumns(['Client Name', 'Start Time', 'Cost']);
  assert.strictEqual(m.get('client name'), 'Client Name');
  assert.strictEqual(m.get('start date time'), 'Start Time');
});

test('COLUMN_ALIASES keys are lowercase', () => {
  for (const k of Object.keys(COLUMN_ALIASES)) {
    assert.strictEqual(k, k.toLowerCase(), `alias key not lower: ${k}`);
  }
});
