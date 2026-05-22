import assert from 'node:assert';
import test from 'node:test';
import {
  buildStandardDocFromFields,
  buildStandardVsForecastRecord,
  countDaysInRange,
  sortStandardRecords,
} from './standardForecast.service.js';

test('golden: sortStandardRecords Mon→Sun then start time', () => {
  const input = [
    { day: 'Friday', startTime: '14:00' },
    { day: 'Monday', startTime: '06:00' },
    { day: 'Monday', startTime: '14:00' },
    { day: 'Friday', startTime: '06:00' },
    { day: 'Sunday', startTime: '08:00' },
  ];
  const sorted = sortStandardRecords(input);
  assert.deepStrictEqual(
    sorted.map((r) => `${r.day} ${r.startTime}`),
    [
      'Monday 06:00',
      'Monday 14:00',
      'Friday 06:00',
      'Friday 14:00',
      'Sunday 08:00',
    ]
  );
});

test('golden: countDaysInRange Mon–Sun over two weeks', () => {
  const start = new Date('2026-04-06T12:00:00.000Z');
  const end = new Date('2026-04-19T12:00:00.000Z');
  const counts = countDaysInRange(start, end);
  assert.strictEqual(counts.monday, 2);
  assert.strictEqual(counts.tuesday, 2);
  assert.strictEqual(counts.sunday, 2);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  assert.strictEqual(total, 14);
});

test('golden: buildStandardVsForecastRecord variance', () => {
  const r = buildStandardVsForecastRecord('c1', 'Acme', 100, 120);
  assert.strictEqual(r.standardBudget, 100);
  assert.strictEqual(r.forecastBudget, 120);
  assert.strictEqual(r.variance, 20);
  assert.strictEqual(r.variancePercentage, 20);
});

test('golden: buildStandardVsForecastRecord variance pct null when standard zero', () => {
  const r = buildStandardVsForecastRecord('c1', 'Acme', 0, 50);
  assert.strictEqual(r.variance, 50);
  assert.strictEqual(r.variancePercentage, null);
});

test('golden: buildStandardDocFromFields manual row', () => {
  const r = buildStandardDocFromFields({
    clientDirectoryId: 'c1',
    clientName: 'Alexandre Noskoff',
    day: 'Monday',
    startTimeStr: '6:00 AM',
    endTimeStr: '10:00 AM',
    duration: '4',
    totalCost: '151.96',
    shiftType: 'Personal Care',
    ratio: '1:01',
  });
  assert.ok(!r.error);
  assert.strictEqual(r.doc.ratio, '1:01');
  assert.strictEqual(r.doc.startTime, '06:00');
  assert.strictEqual(r.doc.endTime, '10:00');
  assert.strictEqual(r.doc.totalCost, 151.96);
});

test('golden: standard budget = totalCost × day count', () => {
  const counts = countDaysInRange(
    new Date('2026-04-07T12:00:00.000Z'),
    new Date('2026-04-13T12:00:00.000Z')
  );
  assert.strictEqual(counts.monday, 1);
  const budget = 50 * counts.monday;
  assert.strictEqual(budget, 50);
});
