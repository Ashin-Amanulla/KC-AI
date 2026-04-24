/**
 * Dump a payroll xlsx row (all cells) for an employee to find which column might align with model gross.
 * Run: node scripts/inspect-payroll-row.mjs <payroll.xlsx> "First Last"
 */
import fs from 'fs';
import { createRequire } from 'module';
import { normName, r2 } from '../frontend/src/lib/schadsWageCalc.js';
const require = createRequire(import.meta.url);
const XLSX = require('../frontend/node_modules/xlsx/xlsx.js');

const xlsxPath = process.argv[2] || '/home/cntrlx/Downloads/Payroll Employee Summary - FN ending 19th April (2).xlsx';
const target = process.argv[3] || 'Abhilash Krishnalayam';

const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
let headerIdx = -1;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i].map((c) => c?.toString().toLowerCase());
  if (r.includes('employee') && r.includes('earnings')) {
    headerIdx = i;
    break;
  }
}
const headers = rows[headerIdx].map((c) => String(c ?? '').trim());
const tnorm = normName(target);
let found = null;
for (let i = headerIdx + 1; i < rows.length; i++) {
  const row = rows[i];
  const nameCell = row[0] ?? row[headers.findIndex((h) => h.toLowerCase() === 'employee')];
  const s = nameCell?.toString().trim() ?? '';
  if (normName(s) === tnorm) {
    found = { row: i + 1, name: s, values: row };
    break;
  }
}
if (!found) {
  console.error('Not found:', target);
  process.exit(1);
}
console.log('Sheet row', found.row, '|', found.name);
headers.forEach((h, j) => {
  const v = found.values[j];
  const n = parseFloat(v);
  console.log(j, h || '(empty)', '|', v, !isNaN(n) && String(v).length < 20 ? '=> ' + n : '');
});
