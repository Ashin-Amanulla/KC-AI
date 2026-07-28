#!/usr/bin/env node
/**
 * Full FN 26 Jul 2026 A/B test: Node engine (production) vs Rust CLI vs Payroll.
 * Loads timesheet CSV, rate cards from DB, classifies & calculates per employee.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ─── LOAD TIMESHEET CSV ─────────────────────────────────────────────────────
const csvPath = path.resolve(os.homedir(), 'Downloads/Scheduler_Timesheet_Export_2026-07-28-16-09.csv');
const csvRaw = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const csvHeaders = csvRaw[0].split(',');
function parseCSVRow(line, headers) {
  const vals = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  vals.push(cur.trim());
  const obj = {};
  headers.forEach((h, i) => obj[h.trim()] = vals[i] ?? '');
  return obj;
}
const allRows = csvRaw.slice(1).map(l => parseCSVRow(l, csvHeaders));
console.error(`CSV: ${allRows.length} total rows`);

const FN_START = new Date('2026-07-13T00:00:00+10:00');
const FN_END   = new Date('2026-07-26T23:59:59+10:00');

function parseDT(s) {
  if (!s) return null;
  // "2026-07-13 00:00:00 +1000"
  const m = s.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/);
  if (!m) return new Date(s);
  return new Date(m[1] + 'T' + m[2] + m[3].slice(0, 3) + ':' + m[3].slice(3));
}
function isPH(d) { return false; } // No QLD PH in 13-26 Jul 2026

// Filter to FN
const shifts = allRows.filter(r => {
  const dt = parseDT(r['Start Date Time']);
  if (!dt) return false;
  if (dt < FN_START || dt > FN_END) return false;
  if (r.Absent?.toLowerCase() === 'true') return false;
  if (r['Shift Status']?.toLowerCase() === 'cancelled') return false;
  return true;
});
console.error(`FN shifts: ${shifts.length}`);

// Group by staff
const byStaff = {};
for (const r of shifts) {
  const name = r['Staff'] || r['Name'] || 'Unknown';
  if (!byStaff[name]) byStaff[name] = [];
  byStaff[name].push(r);
}
console.error(`Staff count: ${Object.keys(byStaff).length}`);

// ─── LOAD RATES FROM DB ─────────────────────────────────────────────────────
// Node 25 has built-in fetch
const BASE = 'http://localhost:3001/api';
const auth = await (await fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@kc-ai.com', password: 'Admin@2026' }),
})).json();
const token = auth.token;
console.error(`API token: ${token ? 'OK' : 'FAIL'}`);

const rateResp = await fetch(BASE + '/staff-rates?locationId=69eaaa638d3940d9bae7fcdd', {
  headers: { Authorization: `Bearer ${token}` },
});
const rateData = await rateResp.json();
const rateRows = rateData.staffRates || rateData.rates || [];
console.error(`Rate rows: ${rateRows.length}`);

// Build normName lookup
function norm(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ');
}
const rateByNorm = {};
for (const row of rateRows) {
  const rates = row.rates || {};
  rateByNorm[norm(row.staffName)] = rates;
  if (row.normName) rateByNorm[row.normName] = rates;
  if (row.aliases) for (const a of row.aliases) rateByNorm[a] = rates;
}

// ─── IMPORT NODE ENGINE ──────────────────────────────────────────────────────
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import { calcGrossFromRates } from '../backend/modules/pay-hours/services/wageCalculator.js';

// ─── HELPER: convert CSV row to Node shift object ───────────────────────────
function toNodeShift(r) {
  const start = parseDT(r['Start Date Time']);
  const end   = parseDT(r['End Date Time']);
  const shiftType = (r['Shift Type'] || '').toLowerCase().includes('sleepover') ? 'sleepover'
    : (r['Shift Type'] || '').toLowerCase().includes('nursing') ? 'nursing_support'
    : 'personal_care';
  return {
    _id: r['Shift ID'],
    staffName: r['Staff'],
    startDatetime: start,
    endDatetime: end,
    hours: (end - start) / 3600000,
    shiftType,
    isBrokenShift: false,
    timezoneOffset: '+10:00',
    mileage: parseFloat(r['Mileage'] || 0),
    clientName: r['Name'],
  };
}

// ─── HELPER: Rust fixture ────────────────────────────────────────────────────
function toRustShift(r) {
  const start = parseDT(r['Start Date Time']);
  const end   = parseDT(r['End Date Time']);
  const locStart = start.toLocaleString('sv', { timeZone: 'Australia/Brisbane' }).replace(' ', 'T');
  const locEnd   = end.toLocaleString('sv', { timeZone: 'Australia/Brisbane' }).replace(' ', 'T');
  return {
    start: locStart, end: locEnd,
    sleepover: (r['Shift Type'] || '').toLowerCase().includes('sleepover'),
    agreed_twelve_hour_sleepover_shift: false, authorised_overtime: false,
  };
}

// ─── CALCULATE ───────────────────────────────────────────────────────────────
const results = [];

for (const [staffName, staffShifts] of Object.entries(byStaff)) {
  // Normalise name for rate lookup
  const nk = norm(staffName);
  const rates = rateByNorm[nk];

  // Node engine
  let nodeGross = null, nodePH = null;
  if (rates) {
    const nodeShifts = staffShifts.map(toNodeShift);
    const { data } = computePayHoursForStaff(nodeShifts, new Set()); // no PH
    nodeGross = calcGrossFromRates(data, rates);
    nodePH = data;
  }

  // Find payroll match
  results.push({
    staff: staffName,
    norm: nk,
    hasRates: !!rates,
    nodeGross,
    shiftCount: staffShifts.length,
  });
}

console.log(JSON.stringify({
  total: results.length,
  withRates: results.filter(r => r.hasRates).length,
  withoutRates: results.filter(r => !r.hasRates).map(r => r.staff),
  results,
}, null, 2));
