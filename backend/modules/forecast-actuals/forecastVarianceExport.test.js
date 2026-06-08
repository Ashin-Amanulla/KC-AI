import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildVarianceExportRowList,
  countVarianceExportRows,
} from './varianceExportRows.js';

test('countVarianceExportRows sums deleted, additional, and variance tabs once', () => {
  const deleted = [{ shiftcareId: 'd1' }, { shiftcareId: 'd2' }];
  const additional = [{ shiftcareId: 'a1' }];
  const variance = [
    { shiftcareId: 'v1', source: 'forecast' },
    { shiftcareId: 'v1', source: 'actuals' },
  ];
  assert.strictEqual(countVarianceExportRows(deleted, additional, variance), 5);
});

test('buildVarianceExportRowList labels variance rows by source', () => {
  const rows = buildVarianceExportRowList(
    [{ shiftcareId: 'd1' }],
    [{ shiftcareId: 'a1' }],
    [
      { shiftcareId: 'v1', source: 'forecast' },
      { shiftcareId: 'v1', source: 'actuals' },
    ]
  );
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[0].typeLabel, 'Deleted');
  assert.strictEqual(rows[1].typeLabel, 'Additional');
  assert.strictEqual(rows[2].typeLabel, 'Variance - Forecast');
  assert.strictEqual(rows[3].typeLabel, 'Variance - Actuals');
});

test('exportVarianceCsv uses buildVarianceExportRecords not listVariance pagination', () => {
  const servicePath = fileURLToPath(new URL('./forecastActuals.service.js', import.meta.url));
  const src = readFileSync(servicePath, 'utf8');
  const exportFn = src.slice(src.indexOf('export async function exportVarianceCsv'));
  assert.ok(exportFn.includes('buildVarianceExportRecords'), 'single-pass export helper');
  assert.ok(!exportFn.includes('listVariance('), 'must not paginate listVariance');
});
