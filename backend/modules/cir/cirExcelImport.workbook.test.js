import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { parseCirWorkbookBuffer } from './cirExcelImport.js';

test('parseCirWorkbookBuffer reads sample workbook rows', () => {
  const xlsxPath = path.join(
    process.env.HOME || '',
    'Downloads',
    'Continious Improvement Register.xlsx'
  );
  if (!fs.existsSync(xlsxPath)) {
    console.log('skip: sample workbook not found');
    return;
  }
  const buffer = fs.readFileSync(xlsxPath);
  const rows = parseCirWorkbookBuffer(buffer);
  assert.ok(rows.length >= 12);
  assert.equal(rows[0].cirId, 'CIR-2026-001');
});
