import assert from 'node:assert';
import test from 'node:test';
import { buildNormalizedColumns } from './csvForecastActuals.js';
import { buildSummaryRecord, processRowCommon } from './forecastActuals.service.js';

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
  assert.strictEqual(doc.ratio, '1:02');
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
