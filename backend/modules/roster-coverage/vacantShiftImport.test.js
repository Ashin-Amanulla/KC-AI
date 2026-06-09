import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  normalizeClientName,
  isSleepoverShiftType,
  parseVacantShiftRow,
  parseVacantShiftBuffer,
} from './vacantShiftImport.js';

test('normalizeClientName takes first segment after comma split', () => {
  assert.strictEqual(normalizeClientName('Alice, Alice'), 'Alice');
  assert.strictEqual(normalizeClientName('  Bob  '), 'Bob');
  assert.strictEqual(normalizeClientName(''), '');
});

test('isSleepoverShiftType detects sleepover', () => {
  assert.strictEqual(isSleepoverShiftType('Sleepover'), true);
  assert.strictEqual(isSleepoverShiftType('Personal Care'), false);
});

test('parseVacantShiftRow maps ShiftCare vacant report columns', () => {
  const row = {
    'Shift ID': '123898090',
    'Start At': '12/06/2026 06:00 AM',
    'End At': '12/06/2026 02:00 PM',
    Client: 'Mohammed Sunny Manikam',
    'Price Book': '01 Assistance In Supported Independent Living Standard Am',
    'Shift Type': 'Personal Care',
    Team: 'Sunny Manikam (Staff List)',
    Address: 'unit 3/61 Cinderella Drive, Springwood QLD, Australia',
    'Duration (Hrs)': '8.0',
  };
  const colMap = new Map(
    Object.keys(row).map((k) => [k.trim().toLowerCase().replace(/\s+/g, ' '), k])
  );
  const { row: parsed, error } = parseVacantShiftRow(row, colMap, 2);
  assert.ifError(error);
  assert.strictEqual(parsed.shiftcareShiftId, '123898090');
  assert.strictEqual(parsed.clientName, 'Mohammed Sunny Manikam');
  assert.strictEqual(parsed.sleepover, false);
  assert.ok(parsed.startDatetime instanceof Date);
  assert.ok(parsed.endDatetime instanceof Date);
  assert.ok(parsed.notes.includes('Cinderella Drive'));
});

test('parseVacantShiftRow flags sleepover shift type', () => {
  const row = {
    'Shift ID': '128733295',
    'Start At': '15/06/2026 10:00 PM',
    'End At': '16/06/2026 06:00 AM',
    Client: 'Tracey Cappetti, Susan Gillespie',
    'Shift Type': 'Sleepover',
    Address: '6 Saltbush Street',
  };
  const colMap = new Map(
    Object.keys(row).map((k) => [k.trim().toLowerCase().replace(/\s+/g, ' '), k])
  );
  const { row: parsed } = parseVacantShiftRow(row, colMap, 2);
  assert.strictEqual(parsed.clientName, 'Tracey Cappetti');
  assert.strictEqual(parsed.sleepover, true);
});

test('parseVacantShiftBuffer rejects missing headers', () => {
  const csv = 'Foo,Bar\n1,2\n';
  const result = parseVacantShiftBuffer(Buffer.from(csv), 'test.csv');
  assert.strictEqual(result.rows.length, 0);
  assert.ok(result.errors[0].includes('Missing required columns'));
});

test('parseVacantShiftBuffer parses sample vacant shifts CSV', () => {
  const fixture = path.join(
    process.cwd(),
    'tmp/test/vacant_shifts_report-1780878469.csv'
  );
  if (!fs.existsSync(fixture)) {
    console.log('skip: fixture not present');
    return;
  }
  const buffer = fs.readFileSync(fixture);
  const result = parseVacantShiftBuffer(buffer, 'vacant_shifts_report.csv');
  assert.ok(result.rows.length > 200, `expected 200+ rows, got ${result.rows.length}`);
  assert.strictEqual(result.errors.length, 0);
});
