import assert from 'node:assert';
import test from 'node:test';
import { buildNormalizedColumns } from './csvStandardForecast.js';
import { countDaysInRange } from './standardForecast.service.js';

test('smoke: standard CSV columns normalize for KC Studio export shape', () => {
  const headers = [
    'Client Name',
    'Day',
    'Start Date Time',
    'End Date Time',
    'Duration',
    'Total Cost',
    'Shift Type',
  ];
  const norm = buildNormalizedColumns(headers);
  assert.ok(norm.has('client name'));
  assert.ok(norm.has('day'));
  assert.ok(norm.has('start date time'));
  assert.ok(norm.has('total cost'));
});

test('smoke: two-week forecast range drives standard budget multiplier', () => {
  const start = new Date('2026-04-06T12:00:00.000Z');
  const end = new Date('2026-04-19T12:00:00.000Z');
  const counts = countDaysInRange(start, end);
  const mondayShiftsPerWeek = 1;
  const costPerShift = 100;
  const expectedBudget = costPerShift * counts.monday * mondayShiftsPerWeek;
  assert.strictEqual(expectedBudget, 200);
});
