import assert from 'node:assert';
import test from 'node:test';
import {
  buildStandardDocFromFields,
  buildStandardVsForecastRecord,
  buildTemplateKey,
  computeStandardVarianceDiff,
  countDaysInRange,
  parseTemplateKey,
  sortStandardRecords,
} from './standardForecast.service.js';
import { compareTemplateKeys, sortTemplateKeys } from '../../utils/weekdaySort.js';

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

test('golden: sortTemplateKeys Mon→Sun not alphabetical', () => {
  const keys = [
    'c1|friday|14:00',
    'c1|monday|06:00',
    'c1|sunday|08:00',
    'c1|monday|14:00',
  ];
  sortTemplateKeys(keys);
  assert.deepStrictEqual(keys, [
    'c1|monday|06:00',
    'c1|monday|14:00',
    'c1|friday|14:00',
    'c1|sunday|08:00',
  ]);
  assert.ok(compareTemplateKeys('c1|monday|06:00', 'c1|tuesday|08:00') < 0);
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

test('golden: buildTemplateKey round-trips through parseTemplateKey', () => {
  const key = buildTemplateKey({
    clientDirectoryId: 'c1',
    day: 'Monday',
    startTime: '06:00',
  });
  assert.strictEqual(key, 'c1|monday|06:00');
  assert.deepStrictEqual(parseTemplateKey(key), {
    clientDirectoryId: 'c1',
    day: 'monday',
    startTime: '06:00',
  });
});

test('golden: buildTemplateKey normalizes day casing/whitespace', () => {
  assert.strictEqual(
    buildTemplateKey({ clientDirectoryId: 'c2', day: '  Friday ', startTime: '14:00' }),
    'c2|friday|14:00'
  );
});

const baseStd = {
  clientName: 'Acme',
  startTime: '06:00',
  endTime: '10:00',
  duration: 4,
  totalCost: 400,
  rateGroups: 'RG1',
  shiftType: 'Personal Care',
  ratio: '1:01',
  templateKey: 'c1|monday|06:00',
};

test('golden: computeStandardVarianceDiff returns empty when buckets match', () => {
  const fcs = { ...baseStd, startTime: '06:00' };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), []);
});

test('golden: computeStandardVarianceDiff detects end_datetime only', () => {
  const fcs = { ...baseStd, endTime: '10:30' };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['end_datetime']);
});

test('golden: computeStandardVarianceDiff detects duration only', () => {
  const fcs = { ...baseStd, duration: 4.5 };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['duration']);
});

test('golden: computeStandardVarianceDiff detects total_cost only', () => {
  const fcs = { ...baseStd, totalCost: 420 };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['total_cost']);
});

test('golden: computeStandardVarianceDiff detects rate_groups only', () => {
  const fcs = { ...baseStd, rateGroups: 'RG2' };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['rate_groups']);
});

test('golden: computeStandardVarianceDiff detects shift_type only', () => {
  const fcs = { ...baseStd, shiftType: 'Respite' };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['shift_type']);
});

test('golden: computeStandardVarianceDiff detects ratio only', () => {
  const fcs = { ...baseStd, ratio: '1:02' };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), ['ratio']);
});

test('golden: computeStandardVarianceDiff treats cent-level money diff as equal', () => {
  const fcs = { ...baseStd, totalCost: 400.001 };
  assert.deepStrictEqual(computeStandardVarianceDiff(baseStd, fcs), []);
});
