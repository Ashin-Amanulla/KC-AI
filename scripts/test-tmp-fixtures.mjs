#!/usr/bin/env node
/**
 * Smoke-test cost analysis, employee-hours export, and pay-hours using tmp/test fixtures.
 *
 * Usage: node scripts/test-tmp-fixtures.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import { staffTotalHours } from '../frontend/src/lib/schadsWageCalc.js';
import { buildStaffPaySummaryCsvContent } from '../frontend/src/lib/staffPaySummaryExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../backend/package.json'));
const { parse } = require('csv-parse/sync');
const FIX = path.join(__dirname, '../tmp/test');

const BILLING_RAW = path.join(FIX, 'Cost_Breakdown_Raw_Export_1780370012.csv');
const BILLING_SUMMARY = path.join(FIX, 'Cost_Breakdown_Summary_Export_1780370020.csv');
const TIMESHEET_HOURS = path.join(FIX, 'Timesheet_Export_1780369945_all_hours.csv');

const r2 = (n) => Math.round(n * 100) / 100;
let failed = 0;

function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${label}${detail ? `: ${detail}` : ''}`);
  } else {
    console.log(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
    failed++;
  }
}

/** Robust CSV parse for billing raw (ShiftCare export). */
function parseBillingCsv(text) {
  const records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return records
    .map((r) => ({
      client: r['Client Name']?.trim(),
      date: r.Date?.trim(),
      shiftId: r['Shift ID']?.trim(),
      staff: r.Staff?.trim(),
      startDt: r['Start Date Time']?.trim(),
      endDt: r['End Date Time']?.trim(),
      duration: parseFloat(String(r.Duration || '').replace(/[^\d.]/g, '')) || 0,
      cost: parseFloat(r.Cost) || 0,
      totalCost: parseFloat(r['Total Cost']) || 0,
      rateGroup: r['Rate Groups']?.trim(),
      shiftType: r['Shift Type']?.trim(),
      status: r.Status?.trim(),
    }))
    .filter((r) => r.client && r.duration > 0);
}

function parseBillingDateTime(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let hour = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const pm = m[6].toLowerCase() === 'pm';
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const offsetStr = '+10:00';
  const sign = 1;
  const utc = new Date(Date.UTC(year, month - 1, day, hour - 10, min, 0));
  return { date: utc, offsetStr, localKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

const SHIFT_TYPE_MAP = {
  'personal care': 'personal_care',
  sleepover: 'sleepover',
  'nursing support': 'nursing_support',
};

function billingRowsToShifts(rows) {
  const shifts = [];
  let i = 0;
  for (const r of rows) {
    const start = parseBillingDateTime(r.startDt);
    const end = parseBillingDateTime(r.endDt);
    const shiftType = SHIFT_TYPE_MAP[(r.shiftType || '').toLowerCase()];
    if (!start || !end || !shiftType || end.date <= start.date) continue;
    shifts.push({
      _id: `billing-${++i}`,
      staffName: r.staff.trim(),
      clientName: r.client,
      startDatetime: start.date,
      endDatetime: end.date,
      hours: r.duration,
      shiftType,
      isBrokenShift: false,
      dayOfWeek: 0,
      timezoneOffset: start.offsetStr,
    });
  }
  return detectBrokenShifts(shifts);
}

function analyzeStaff(rows) {
  const byStaff = {};
  for (const r of rows) {
    const staff = r.staff?.trim();
    if (!staff) continue;
    const key = staff.toLowerCase();
    if (!byStaff[key]) byStaff[key] = { name: staff, revenue: 0, hours: 0, n: 0 };
    byStaff[key].revenue = r2(byStaff[key].revenue + r.totalCost);
    byStaff[key].hours = r2(byStaff[key].hours + r.duration);
    byStaff[key].n++;
  }
  return Object.values(byStaff);
}

function parseSummaryClients(text) {
  const records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const map = new Map();
  for (const row of records) {
    const name = (row[''] || row.Client || Object.values(row)[0] || '').toString().replace(/^"|"$/g, '').trim();
    const totalStr = row.Total || row.total;
    if (!name || totalStr == null) continue;
    const total = parseFloat(String(totalStr).replace(/[$,]/g, ''));
    if (!isNaN(total)) map.set(name, total);
  }
  return map;
}

console.log('\n=== tmp/test fixture smoke tests ===\n');

// ── 1. Cost analysis billing raw ───────────────────────────────────────────
console.log('1) Cost analysis — Cost_Breakdown_Raw_Export');
if (!fs.existsSync(BILLING_RAW)) {
  ok('billing raw file exists', false, BILLING_RAW);
} else {
  const billingRows = parseBillingCsv(fs.readFileSync(BILLING_RAW, 'utf8'));
  ok('parses billing rows', billingRows.length > 0, `${billingRows.length} rows`);
  ok('duration parsed from "X hrs" suffix', billingRows.every((r) => r.duration > 0));

  const staffRows = analyzeStaff(billingRows);
  ok('staff aggregates', staffRows.length > 0, `${staffRows.length} staff`);
  const abd = staffRows.find((s) => s.name === 'Abdullateef Kuranga');
  if (abd) {
    ok('Abdullateef Kuranga revenue/hours', abd.revenue > 4000 && abd.hours === 55, `$${abd.revenue} / ${abd.hours}h`);
    ok('Abdullateef rev/hr ~$75', Math.abs(abd.revenue / abd.hours - 75.32) < 1, `$${r2(abd.revenue / abd.hours)}/hr`);
  }

  const byClient = {};
  for (const r of billingRows) {
    byClient[r.client] = r2((byClient[r.client] || 0) + r.totalCost);
  }
  const summaryMap = parseSummaryClients(fs.readFileSync(BILLING_SUMMARY, 'utf8'));
  let clientChecks = 0;
  let clientMatch = 0;
  for (const [client, rawTotal] of Object.entries(byClient)) {
    const sumTotal = summaryMap.get(client);
    if (sumTotal == null) continue;
    clientChecks++;
    if (Math.abs(rawTotal - sumTotal) < 0.02) clientMatch++;
  }
  console.log(
    `     note: summary Booked vs raw invoiced totals differ for some clients (${clientMatch}/${clientChecks} exact match) — different ShiftCare export scopes`
  );
  ok('summary export readable', summaryMap.size > 0, `${summaryMap.size} clients in summary file`);
}

// ── 2. ShiftCare employee hours timesheet export ─────────────────────────────
console.log('\n2) Employee hours — Timesheet_Export_all_hours');
if (!fs.existsSync(TIMESHEET_HOURS)) {
  ok('timesheet hours file exists', false, TIMESHEET_HOURS);
} else {
  const records = parse(fs.readFileSync(TIMESHEET_HOURS, 'utf8'), { columns: true, skip_empty_lines: true });
  ok('parses staff rows', records.length > 0, `${records.length} staff`);
  const abd = records.find((r) => r.Name === 'Abdullateef Kuranga');
  ok('Abdullateef Total hours column', abd && parseFloat(abd.Total) === 39, `Total=${abd?.Total}`);
  const withHours = records.filter((r) => parseFloat(r.Total) > 0);
  ok('staff with hours > 0', withHours.length > 50, `${withHours.length} staff`);
}

// ── 3. Pay hours from billing-derived shifts ─────────────────────────────────
console.log('\n3) Pay hours engine — shifts derived from billing raw');
if (fs.existsSync(BILLING_RAW)) {
  const billingRows = parseBillingCsv(fs.readFileSync(BILLING_RAW, 'utf8'));
  const abdBilling = billingRows.filter((r) => r.staff === 'Abdullateef Kuranga');
  const shifts = billingRowsToShifts(abdBilling);
  ok('billing → shift conversion', shifts.length > 0, `${shifts.length}/${abdBilling.length} rows`);
  shifts.sort((a, b) => +a.startDatetime - +b.startDatetime);
  const holidaySet = new Set();
  const { data } = computePayHoursForStaff(shifts, holidaySet);
  const computedTotal = staffTotalHours(data);
  ok('computePayHoursForStaff runs', computedTotal > 0, `${computedTotal}h computed`);
  ok(
    'computed hours align with timesheet Total (sleepovers excluded from staffTotalHours)',
    Math.abs(computedTotal - 39) <= 1,
    `timesheet 39h vs computed ${computedTotal}h (billing raw sums 55h incl. sleepover lines)`
  );

  const exportRows = [{ staffName: 'Abdullateef Kuranga', ...data }];
  const csv = buildStaffPaySummaryCsvContent(exportRows, {
    getMergedRow: (row) => row,
    getGrossPay: () => null,
  });
  ok('employee hours CSV export builds', csv.includes('Abdullateef Kuranga') && csv.includes('Employee'));
  const outPath = path.join(FIX, 'employee_hours_abdullateef_test.csv');
  fs.writeFileSync(outPath, csv);
  console.log(`     wrote ${outPath}`);
}

// ── 4. Pay hours unit tests ──────────────────────────────────────────────────
console.log('\n4) Pay hours calculator unit tests');
import { execFileSync } from 'child_process';
try {
  execFileSync(process.execPath, ['--test', path.join(__dirname, '../backend/modules/pay-hours/services/payHoursCalculator.test.js')], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  ok('payHoursCalculator.test.js', true);
} catch (e) {
  ok('payHoursCalculator.test.js', false, e.stdout?.slice(-500) || e.message);
}

// ── 5. Shift CSV upload formats ──────────────────────────────────────────────
console.log('\n5) Shift upload — CSV format detection');

const scheduler = path.join(__dirname, '../backend/uploads/1778342728970-Scheduler_Timesheet_Export_2026-05-05-00-42.csv');
if (fs.existsSync(scheduler)) {
  const r = parseShiftCsvBuffer(fs.readFileSync(scheduler));
  ok('Scheduler_Timesheet_Export parses', r.shifts.length > 0, `${r.shifts.length} shifts`);
} else {
  console.log('     skip: no Scheduler fixture in backend/uploads');
}

const allHours = path.join(FIX, 'Timesheet_Export_1780369945_all_hours.csv');
const allHoursResult = parseShiftCsvBuffer(fs.readFileSync(allHours));
ok(
  'Timesheet all_hours rejected with helpful message',
  allHoursResult.shifts.length === 0 && allHoursResult.errors[0]?.includes('all hours'),
  allHoursResult.errors[0]?.slice(0, 80)
);

const billingRaw = path.join(FIX, 'Cost_Breakdown_Raw_Export_1780370012.csv');
const billingResult = parseShiftCsvBuffer(fs.readFileSync(billingRaw));
ok('Cost_Breakdown_Raw parses as shifts', billingResult.shifts.length > 100, `${billingResult.shifts.length} shifts`);
if (failed > 0) {
  console.log(`\n${failed} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll checks passed.\n');
