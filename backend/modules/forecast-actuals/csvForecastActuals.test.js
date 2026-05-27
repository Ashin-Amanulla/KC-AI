import assert from 'node:assert';
import test from 'node:test';
import {
  buildNormalizedColumns,
  COLUMN_ALIASES,
  combineDateAndTime,
  moneyEqual,
  normalizeColumnName,
  parseBoolean,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseTime,
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

test('validateHeaders accepts cost without total cost column', () => {
  const keys = new Set([...REQUIRED_CSV_COLUMNS]);
  assert.deepStrictEqual(validateHeaders(keys), []);
});

test('parseTime handles seconds and AM/PM', () => {
  assert.strictEqual(parseTime('  2:00:00 PM'), '14:00');
  assert.strictEqual(parseTime('6:00:00 AM'), '06:00');
});

test('combineDateAndTime merges US date with time-only', () => {
  const shiftDate = parseDate('05/25/2026');
  const start = combineDateAndTime(shiftDate, ' 2:00:00 PM');
  assert.strictEqual(start.toISOString(), '2026-05-25T14:00:00.000Z');
  const end = combineDateAndTime(shiftDate, ' 4:00:00 PM');
  assert.strictEqual(end.toISOString(), '2026-05-25T16:00:00.000Z');
});

test('combineDateAndTime supports overnight end on next calendar day', () => {
  const shiftDate = parseDate('05/25/2026');
  const start = combineDateAndTime(shiftDate, '10:00:00 PM');
  let end = combineDateAndTime(shiftDate, '6:00:00 AM');
  assert.ok(end <= start);
  end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  assert.strictEqual(end.toISOString(), '2026-05-26T06:00:00.000Z');
});

test('normalizeColumnName collapses extra spaces in headers', () => {
  assert.strictEqual(normalizeColumnName('Date '), 'date');
  assert.strictEqual(normalizeColumnName('Start  Time'), 'start date time');
  assert.strictEqual(normalizeColumnName('End  Time'), 'end date time');
});

test('normalizeTimeInput fixes stray leading digit before time', () => {
  const shiftDate = parseDate('05/25/2026');
  const end = combineDateAndTime(shiftDate, '6  4:00:00 PM');
  assert.strictEqual(end.toISOString(), '2026-05-25T16:00:00.000Z');
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

test('normalizeColumnName maps Ratio header', () => {
  assert.strictEqual(normalizeColumnName('Ratio'), 'ratio');
});

test('COLUMN_ALIASES keys are lowercase', () => {
  for (const k of Object.keys(COLUMN_ALIASES)) {
    assert.strictEqual(k, k.toLowerCase(), `alias key not lower: ${k}`);
  }
});
