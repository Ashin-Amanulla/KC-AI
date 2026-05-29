import assert from 'node:assert';
import test from 'node:test';
import { buildNormalizedColumns } from './csvForecastActuals.js';
import {
  buildSummaryRecord,
  buildVariancePairKey,
  parseVariancePairKey,
  processRowCommon,
} from './forecastActuals.service.js';

function maps() {
  const clientMap = new Map();
  clientMap.set('demo client', { id: 'client-1', displayName: 'Demo Client' });
  const staffMap = new Map();
  staffMap.set('alex worker', { id: 'staff-1', displayName: 'Alex Worker' });
  return { clientMap, staffMap };
}

test('golden: processRowCommon happy path matches expected doc', () => {
  const row = {
    'Client Name': 'Demo Client',
    Date: '15/04/2026',
    'Staff Name': 'Alex Worker',
    'Start Date Time': '15/04/2026 09:00',
    'End Date Time': '15/04/2026 17:00',
    Duration: '8',
    Cost: '100.00',
    'Total Cost': '100.00',
    'Shift ID': 'SHIFT-1',
    Ratio: '1:02',
  };
  const norm = buildNormalizedColumns(Object.keys(row));
  const { clientMap, staffMap } = maps();
  const r = processRowCommon(row, norm, staffMap, clientMap, 2);
  assert.ok(!r.error);
  const { doc } = r;
  assert.strictEqual(doc.clientDirectoryId, 'client-1');
  assert.strictEqual(doc.staffDirectoryId, 'staff-1');
  assert.strictEqual(doc.shiftcareId, 'SHIFT-1');
  assert.strictEqual(doc.duration, 8);
  assert.strictEqual(doc.cost, 100);
  assert.strictEqual(doc.totalCost, 100);
  assert.strictEqual(doc.shiftDate.toISOString().slice(0, 10), '2026-04-15');
  assert.strictEqual(doc.startDatetime.toISOString(), '2026-04-15T09:00:00.000Z');
  assert.strictEqual(doc.endDatetime.toISOString(), '2026-04-15T17:00:00.000Z');
  assert.strictEqual(doc.ratio, '1:2');
});

test('golden: processRowCommon normalizes ratio leading zeros', () => {
  const row = {
    'Client Name': 'Demo Client',
    Date: '15/04/2026',
    'Start Date Time': '15/04/2026 09:00',
    'End Date Time': '15/04/2026 17:00',
    Duration: '8',
    Cost: '100',
    'Total Cost': '100',
    Ratio: '01:02',
  };
  const norm = buildNormalizedColumns(Object.keys(row));
  const clientMap = new Map([['demo client', { id: 'c1', displayName: 'Demo Client' }]]);
  const r = processRowCommon(row, norm, new Map(), clientMap, 2);
  assert.ok(!r.error);
  assert.strictEqual(r.doc.ratio, '1:2');
});

test('golden: processRowCommon Alex-style CSV (date + time columns, cost only)', () => {
  const row = {
    'Client Name': 'Alexandre Noskoff',
    'Date ': '05/25/2026',
    'Start  Time': ' 2:00:00 PM',
    'End  Time': ' 4:00:00 PM',
    Duration: '2.0 hrs',
    Cost: '167.44',
    'Rate Groups': '01 Assistance',
    'Reference No': '01_812_0115_1_1',
    'Shift Type': 'Personal Care',
    'Client Type': 'Ndis Managed',
    Ratio: '1:01',
  };
  const norm = buildNormalizedColumns(Object.keys(row));
  const clientMap = new Map();
  clientMap.set('alexandre noskoff', { id: 'c-alex', displayName: 'Alexandre Noskoff' });
  const r = processRowCommon(row, norm, new Map(), clientMap, 2);
  assert.ok(!r.error, r.error);
  const { doc } = r;
  assert.strictEqual(doc.clientDirectoryId, 'c-alex');
  assert.strictEqual(doc.duration, 2);
  assert.strictEqual(doc.cost, 167.44);
  assert.strictEqual(doc.totalCost, 167.44);
  assert.strictEqual(doc.shiftDate.toISOString().slice(0, 10), '2026-05-25');
  assert.strictEqual(doc.startDatetime.toISOString(), '2026-05-25T14:00:00.000Z');
  assert.strictEqual(doc.endDatetime.toISOString(), '2026-05-25T16:00:00.000Z');
  assert.strictEqual(doc.shiftType, 'Personal Care');
  assert.strictEqual(doc.ratio, '1:1');
});

test('golden: processRowCommon overnight sleepover shift', () => {
  const row = {
    'Client Name': 'Alexandre Noskoff',
    Date: '05/27/2026',
    'Start  Time': '10:00:00 PM',
    'End  Time': '6:00:00 AM',
    Duration: '8.0 hrs',
    Cost: '148.8',
    'Total Cost': '148.8',
  };
  const norm = buildNormalizedColumns(Object.keys(row));
  const clientMap = new Map([['alexandre noskoff', { id: 'c-alex', displayName: 'Alexandre Noskoff' }]]);
  const r = processRowCommon(row, norm, new Map(), clientMap, 3);
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.doc.startDatetime.toISOString(), '2026-05-27T22:00:00.000Z');
  assert.strictEqual(r.doc.endDatetime.toISOString(), '2026-05-28T06:00:00.000Z');
});

test('golden: processRowCommon forecast row with garbled end time', () => {
  const row = {
    'Client Name': 'Alexandre Noskoff',
    Date: '05/25/2026',
    'Start  Time': '  2:00:00 PM',
    'End Date Time': '6  4:00:00 PM',
    Duration: '2.0 hrs',
    Cost: '167.44',
  };
  const norm = buildNormalizedColumns(Object.keys(row));
  const clientMap = new Map([['alexandre noskoff', { id: 'c-alex', displayName: 'Alexandre Noskoff' }]]);
  const r = processRowCommon(row, norm, new Map(), clientMap, 29);
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.doc.endDatetime.toISOString(), '2026-05-25T16:00:00.000Z');
});

test('golden: buildSummaryRecord variance and gross', () => {
  const s = buildSummaryRecord('c1', 'Acme', 200, 150, 10);
  assert.strictEqual(s.forecastBudget, 200);
  assert.strictEqual(s.netActuals, 150);
  assert.strictEqual(s.mileage, 10);
  assert.strictEqual(s.grossActuals, 160);
  assert.strictEqual(s.variance, -50);
  assert.strictEqual(s.variancePercentage, -25);
});

test('golden: buildSummaryRecord variance pct null when forecast zero', () => {
  const s = buildSummaryRecord('c1', 'Acme', 0, 50, 0);
  assert.strictEqual(s.variance, 50);
  assert.strictEqual(s.variancePercentage, null);
});

test('golden: totals variance equals sum of row variances', () => {
  const rows = [
    buildSummaryRecord('c1', 'A', 100, 90, 5),
    buildSummaryRecord('c2', 'B', 200, 220, 0),
  ];
  const sumVariance = rows.reduce((s, r) => s + r.variance, 0);
  const totalForecast = rows.reduce((s, r) => s + r.forecastBudget, 0);
  assert.strictEqual(sumVariance, 10);
  assert.strictEqual((sumVariance / totalForecast) * 100, 10 / 3);
});

test('golden: variance pair key is shift id + client', () => {
  const k1 = buildVariancePairKey('SHIFT-1', 'client-a', 'Alice');
  const k2 = buildVariancePairKey('SHIFT-1', 'client-b', 'Bob');
  assert.notStrictEqual(k1, k2);
  assert.ok(k1.includes('SHIFT-1'));
  assert.ok(k1.includes('id:client-a'));
  const parsed = parseVariancePairKey(k1);
  assert.strictEqual(parsed.shiftcareId, 'SHIFT-1');
  assert.strictEqual(parsed.clientKey, 'id:client-a');
  const nameKey = buildVariancePairKey('SHIFT-2', '', 'Charlie');
  assert.ok(nameKey.endsWith('name:charlie'));
});
