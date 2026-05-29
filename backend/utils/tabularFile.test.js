import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseTabularBuffer, isSpreadsheetFilename } from './tabularFile.js';

test('isSpreadsheetFilename accepts csv and xlsx', () => {
  assert.equal(isSpreadsheetFilename('data.csv'), true);
  assert.equal(isSpreadsheetFilename('data.xlsx'), true);
  assert.equal(isSpreadsheetFilename('data.xls'), true);
  assert.equal(isSpreadsheetFilename('data.pdf'), false);
});

test('parseTabularBuffer parses csv text', () => {
  const buf = Buffer.from('Name,Cost\nAlice,10\n', 'utf-8');
  const rows = parseTabularBuffer(buf, 'test.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, 'Alice');
  assert.equal(String(rows[0].Cost), '10');
});

test('parseTabularBuffer parses xlsx first sheet', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Cost'],
    ['Bob', 20],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const rows = parseTabularBuffer(buf, 'test.xlsx');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, 'Bob');
  assert.equal(String(rows[0].Cost), '20');
});
