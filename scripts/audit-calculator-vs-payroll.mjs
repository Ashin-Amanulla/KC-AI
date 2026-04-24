/**
 * Offline audit: scheduler CSV → pay hours (same as backend) vs payroll xlsx earnings.
 * Run: node scripts/audit-calculator-vs-payroll.mjs <scheduler.csv> <payroll.xlsx> [staff-rates.xlsx]
 * 3rd XLSX = same "Employee Name / Daytime" SCHADS rates sheet as SchadsCalculator. Optional env: SCHADS_RATES_XLSX
 * If rates file omitted or not found, gross uses $35/h casual (same as old behaviour).
 */
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../frontend/node_modules/xlsx/xlsx.js');
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import {
  calcGross,
  calcGrossFromRates,
  normName,
  r2,
  VEHICLE_RATE,
} from '../frontend/src/lib/schadsWageCalc.js';
import { loadStaffRatesMap } from './lib/staffRatesFromXlsx.mjs';

const DEFAULT_CSV = '/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-04-24-01-37.csv';
const DEFAULT_XLSX = '/home/cntrlx/Downloads/Payroll Employee Summary - FN ending 19th April (2).xlsx';

const csvPath = process.argv[2] || DEFAULT_CSV;
const xlsxPath = process.argv[3] || DEFAULT_XLSX;
const ratesXlsxPath = process.argv[4] || process.env.SCHADS_RATES_XLSX;

const TEST_BASE = 35; // $/h casual — same as UI default for rough comparison

function loadPayrollMap(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
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
  if (headerIdx < 0) throw new Error('No Employee + Earnings header row in payroll xlsx');
  const headers = rows[headerIdx].map((c) => c?.toString().toLowerCase());
  const empIdx = headers.indexOf('employee');
  const earnIdx = headers.indexOf('earnings');
  if (empIdx < 0 || earnIdx < 0) throw new Error('Need Employee and Earnings columns');
  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][empIdx]?.toString().trim();
    const earn = parseFloat(rows[i][earnIdx]);
    if (!name || isNaN(earn) || earn <= 0) continue;
    const nl = name.toLowerCase();
    if (nl === 'total' || nl === 'totals' || nl === 'subtotal' || nl === 'summary') continue;
    map.set(normName(name), { name, earnings: earn });
  }
  return map;
}

function totalPhHours(d) {
  return r2(
    (d.morningHours || 0) +
      (d.afternoonHours || 0) +
      (d.nightHours || 0) +
      (d.weekdayOtUpto2 || 0) +
      (d.weekdayOtAfter2 || 0) +
      (d.saturdayHours || 0) +
      (d.saturdayOtUpto2 || 0) +
      (d.saturdayOtAfter2 || 0) +
      (d.sundayHours || 0) +
      (d.sundayOtUpto2 || 0) +
      (d.sundayOtAfter2 || 0) +
      (d.holidayHours || 0) +
      (d.holidayOtUpto2 || 0) +
      (d.holidayOtAfter2 || 0) +
      (d.nursingCareHours || 0) +
      (d.otAfter76Weekday || 0) +
      (d.otAfter76Saturday || 0) +
      (d.otAfter76Sunday || 0) +
      (d.otAfter76Holiday || 0)
  );
}

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error('XLSX not found:', xlsxPath);
    process.exit(1);
  }

  let staffRatesMap = new Map();
  if (ratesXlsxPath && fs.existsSync(ratesXlsxPath)) {
    staffRatesMap = loadStaffRatesMap(fs.readFileSync(ratesXlsxPath), { normName, r2, VEHICLE_RATE });
    console.log('Staff rates XLSX:', ratesXlsxPath, '| rows loaded:', staffRatesMap.size);
  } else {
    console.log(
      'No staff rates file (pass 3rd .xlsx or set SCHADS_RATES_XLSX) — using',
      'calcGross @ $' + TEST_BASE + '/h casual for everyone without a rates row.'
    );
  }

  const { shifts: raw, errors } = parseShiftCsvBuffer(fs.readFileSync(csvPath));
  if (errors.length) {
    console.error('Parse errors (first 5):', errors.slice(0, 5));
  }
  const shifts = detectBrokenShifts(raw);
  let n = 0;
  for (const s of shifts) {
    s._id = s._id || `csv-${++n}`;
  }

  const min = shifts.length ? new Date(Math.min(...shifts.map((s) => +s.startDatetime))) : null;
  const max = shifts.length ? new Date(Math.max(...shifts.map((s) => +s.endDatetime))) : null;
  console.log('=== Scheduler CSV ===');
  console.log('Rows (shifts):', shifts.length, '| parse errors:', errors.length);
  console.log('Date span (roster):', min?.toISOString(), '→', max?.toISOString());

  const byStaff = new Map();
  for (const s of shifts) {
    const k = s.staffName;
    if (!byStaff.has(k)) byStaff.set(k, []);
    byStaff.get(k).push(s);
  }
  for (const arr of byStaff.values()) {
    arr.sort((a, b) => a.startDatetime - b.startDatetime);
  }

  const holidaySet = new Set();
  const payRows = [];
  for (const [staffName, staffShifts] of byStaff.entries()) {
    const { data } = computePayHoursForStaff(staffShifts, holidaySet);
    const totalKm = staffShifts.reduce((sum, x) => sum + (x.mileage || 0), 0);
    const ph = { ...data, totalKm, staffName };
    const k = normName(staffName);
    const staffRates = staffRatesMap.get(k) ?? null;
    const gross = staffRates ? calcGrossFromRates(ph, staffRates) : calcGross(ph, String(TEST_BASE), 'casual');
    const th = totalPhHours(data);
    payRows.push({ staffName, ph, gross, th, fromRates: !!staffRates });
  }
  payRows.sort((a, b) => a.staffName.localeCompare(b.staffName));

  const payroll = loadPayrollMap(fs.readFileSync(xlsxPath));
  console.log('\n=== Payroll xlsx ===');
  console.log('Staff with earnings row:', payroll.size);

  const matched = [];
  const onlyCsv = [];
  const onlyPay = [];
  for (const r of payRows) {
    const k = normName(r.staffName);
    if (payroll.has(k)) {
      const p = payroll.get(k);
      const diff = r2(p.earnings - (r.gross || 0));
      const pct = r.gross && r.gross > 0 ? r2((diff / r.gross) * 100) : null;
      matched.push({ ...r, payrollEarnings: p.earnings, diff, pct });
    } else {
      onlyCsv.push(r);
    }
  }
  for (const [k, p] of payroll) {
    if (!payRows.some((r) => normName(r.staffName) === k)) onlyPay.push(p);
  }

  const fromRatesN = payRows.filter((r) => r.fromRates).length;
  console.log('\n=== Match summary ===');
  console.log('Matched (name):', matched.length, '| in CSV only:', onlyCsv.length, '| in payroll only:', onlyPay.length);
  console.log('Gross from staff rates xlsx:', fromRatesN, '| fallback $' + TEST_BASE + '/h casual:', payRows.length - fromRatesN);

  const topVar = [...matched]
    .filter((m) => m.gross != null && m.gross > 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 15);

  const rateMode = staffRatesMap.size > 0 ? 'calcGrossFromRates when name matches; else $' + TEST_BASE + '/h casual' : 'calcGross @ $' + TEST_BASE + '/h casual (no rates file)';
  console.log('\nLargest |payroll − calc| (top 15) — ' + rateMode + ':');
  for (const m of topVar) {
    const tag = m.fromRates ? '[rates]' : '[$35]';
    console.log(
      `${m.staffName.slice(0, 28).padEnd(30)} pay $${m.payrollEarnings.toFixed(0).padStart(7)}  calc $${(m.gross || 0).toFixed(0).padStart(7)}  Δ $${m.diff.toFixed(0).padStart(6)}  (${m.pct?.toFixed(0) ?? '—'}%)  ${m.th}h  ${tag}`
    );
  }

  if (onlyPay.length) {
    console.log('\nPayroll only (not in this CSV) — first 20:');
    for (const p of onlyPay.slice(0, 20)) console.log(' ', p.name, '$' + p.earnings);
  }
  if (onlyCsv.length) {
    console.log('\nCSV only (not in payroll) — first 20:');
    for (const r of onlyCsv.slice(0, 20)) {
      console.log(' ', r.staffName, 'calcGross $' + (r.gross || 0).toFixed(0), r.th + 'h');
    }
  }

  console.log(
    '\nNote: without a staff-rates xlsx, calc uses a flat $' +
      TEST_BASE +
      ' casual base + multipliers. With a rates xlsx, per-employee $/h matches SchadsCalculator. Payroll is still actual dollars; mismatch if period, scope, or extra pay items differ from roster.'
  );
}

main();
