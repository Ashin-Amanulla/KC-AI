/**
 * Parse tmp/test/Scheduler_Timesheet_Export_SCHADS_RULES_FIXTURE.csv and run computePayHoursForStaff per staff.
 * Usage: node scripts/verify-schads-rules-fixture.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'tmp/test/Scheduler_Timesheet_Export_SCHADS_RULES_FIXTURE.csv');

const holidaySet = new Set(['2026-04-07', '2026-04-25']);

const buf = fs.readFileSync(csvPath);
const { shifts: raw, errors } = parseShiftCsvBuffer(buf);
if (errors.length) {
  console.error('Parse errors:', errors);
  process.exit(1);
}

const shifts = detectBrokenShifts(raw);
let i = 0;
for (const s of shifts) {
  s._id = s.shiftcareId ? String(s.shiftcareId) : `fixture-${++i}`;
}

const byStaff = new Map();
for (const s of shifts) {
  const k = s.staffName;
  if (!byStaff.has(k)) byStaff.set(k, []);
  byStaff.get(k).push(s);
}
for (const arr of byStaff.values()) {
  arr.sort((a, b) => +a.startDatetime - +b.startDatetime);
}

const checks = [];

for (const [name, arr] of [...byStaff.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const { data } = computePayHoursForStaff(arr, holidaySet);
  const summary = {
    staff: name,
    shifts: arr.length,
    morning: data.morningHours,
    afternoon: data.afternoonHours,
    night: data.nightHours,
    sat: data.saturdayHours,
    sun: data.sundayHours,
    hol: data.holidayHours,
    wdOt1: data.weekdayOtUpto2,
    wdOt2: data.weekdayOtAfter2,
    sunOt2: data.sundayOtAfter2,
    brk: data.brokenShiftCount,
    brk2: data.brokenShift2BreakCount,
    meal: data.mealAllowanceCount,
    so: data.sleepoversCount,
    ot76: data.otAfter76Hours,
    short: data.shortTurnaroundHours,
    nursing: data.nursingCareHours,
  };
  if (process.env.VERBOSE) console.log(JSON.stringify(summary));

  if (name === 'SCHADS Cap76' && (data.otAfter76Hours || 0) <= 0) {
    checks.push('SCHADS Cap76 expected otAfter76Hours > 0');
  }
  if (name === 'SCHADS Broken' && (data.brokenShiftCount || 0) + (data.brokenShift2BreakCount || 0) < 1) {
    checks.push('SCHADS Broken expected broken shift allowance (count or 2-break)');
  }
  if (name === 'SCHADS Broken UTC' && !arr.some((s) => s.isBrokenShift)) {
    checks.push('SCHADS Broken UTC expected at least one isBrokenShift');
  }
  if (name === 'SCHADS Sat Sun PH' && (data.holidayHours || 0) < 8) {
    checks.push('SCHADS Sat Sun PH expected holidayHours for DT03 (PH in holidaySet)');
  }
  if (name === 'SCHADS Nursing' && (data.nursingCareHours || 0) < 1) {
    checks.push('SCHADS Nursing expected nursingCareHours on weekday NS01');
  }
  if (name === 'SCHADS OT Meal' && (data.mealAllowanceCount || 0) < 1) {
    checks.push('SCHADS OT Meal expected some meal allowances');
  }
}

if (checks.length) {
  console.error('FAILED:', checks);
  process.exit(1);
}
console.error('OK: fixture parse + pay hours smoke checks');
