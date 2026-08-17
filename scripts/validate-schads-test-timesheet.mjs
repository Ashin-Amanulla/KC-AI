/**
 * Validate SCHADS_Test_Timesheet.csv against UAT payHoursCalculator.
 * Usage: node scripts/validate-schads-test-timesheet.mjs [csvPath]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] || '/home/cntrlx/Downloads/SCHADS_Test_Timesheet.csv';
const TOLERANCE = 0.02;

const HOLIDAYS = new Set(['2026-05-04', '2026-05-10', '2026-05-12']);

const buf = fs.readFileSync(csvPath);
const { shifts } = parseShiftCsvBuffer(buf);

function r2(n) {
  return Math.round(n * 100) / 100;
}

function bdPayable(bd) {
  if (!bd) return 0;
  return r2(
  (bd.morningHours || 0) +
    (bd.afternoonHours || 0) +
    (bd.nightHours || 0) +
    (bd.saturdayHours || 0) +
    (bd.sundayHours || 0) +
    (bd.holidayHours || 0) +
    (bd.weekdayOtFirst2 || 0) +
    (bd.weekdayOtAfter2 || 0) +
    (bd.saturdayOtFirst2 || 0) +
    (bd.saturdayOtAfter2 || 0) +
    (bd.sundayOtFirst2 || 0) +
    (bd.sundayOtAfter2 || 0) +
    (bd.holidayOtFirst2 || 0) +
    (bd.holidayOtAfter2 || 0) +
    (bd.shortTurnaroundHours || 0) +
    (bd.otAfter76Weekday || 0) +
    (bd.otAfter76WeekdayAfter2 || 0) +
    (bd.otAfter76SaturdayUpto2 || 0) +
    (bd.otAfter76SaturdayAfter2 || 0) +
    (bd.otAfter76Sunday || 0) +
    (bd.otAfter76Holiday || 0)
  );
}

function getBd(shiftBreakdowns, shift) {
  const id = String(shift._id || shift.shiftcareId);
  return shiftBreakdowns.get(id);
}

function staffFortnight(staffName) {
  const staffShifts = shifts.filter((s) => s.staffName === staffName);
  detectBrokenShifts(staffShifts);
  return computePayHoursForStaff(staffShifts, HOLIDAYS);
}

function shiftById(id) {
  return shifts.find((s) => String(s.shiftcareId) === String(id));
}

const results = [];

function check(id, label, ok, detail) {
  results.push({ id, label, ok, detail });
}

// Per-staff fortnight runs (cache)
const staffCache = new Map();
function fortnight(staffName) {
  if (!staffCache.has(staffName)) staffCache.set(staffName, staffFortnight(staffName));
  return staffCache.get(staffName);
}

for (const s of shifts) {
  const note = s.notes || '';
  const m = note.match(/TEST CASE:\s*([A-Z]-\d+[a-z]?)/);
  const caseId = m?.[1] || `shift-${s.shiftcareId}`;
  const { data, shiftBreakdowns } = fortnight(s.staffName);
  const bd = getBd(shiftBreakdowns, s);

  // Section A/B weekday bands
  if (caseId === 'A-03') {
    check(s.shiftcareId, caseId, bd?.morningHours === 6 && !bd?.afternoonHours, `morning=${bd?.morningHours} afternoon=${bd?.afternoonHours}`);
  } else if (caseId === 'A-04' || caseId === 'B-01') {
    check(s.shiftcareId, caseId, bd?.afternoonHours === 8 && !bd?.morningHours, `afternoon=${bd?.afternoonHours}`);
  } else if (caseId === 'A-08') {
    check(s.shiftcareId, caseId, bd?.nightHours === 6, `night=${bd?.nightHours}`);
  } else if (caseId === 'C-02') {
    check(s.shiftcareId, caseId, bd?.morningHours === 10 && bd?.weekdayOtFirst2 === 1, `morning=${bd?.morningHours} ot1=${bd?.weekdayOtFirst2}`);
  } else if (caseId === 'C-03') {
    check(s.shiftcareId, caseId, bd?.morningHours === 10 && bd?.weekdayOtFirst2 === 2 && bd?.weekdayOtAfter2 === 1, bd);
  } else if (caseId === 'C-08') {
    const ot76 = r2((data.otAfter76Weekday || 0) + (data.otAfter76WeekdayAfter2 || 0));
    check(s.shiftcareId, caseId, ot76 >= 1 && bd?.weekdayOtFirst2 === 1, `ot76=${ot76} ot1=${bd?.weekdayOtFirst2}`);
  } else if (caseId === 'D-03') {
    check(s.shiftcareId, caseId, bd?.saturdayHours === 2 && bd?.sundayHours === 2, bd);
  } else if (caseId === 'E-01') {
    check(s.shiftcareId, caseId, bd?.holidayHours === 8, `holiday=${bd?.holidayHours}`);
  } else if (caseId === 'G-01b') {
    check(s.shiftcareId, caseId, s.isBrokenShift && data.brokenShiftCount >= 1, `broken=${s.isBrokenShift} allowance=${data.brokenShiftCount}`);
  } else if (caseId === 'G-02b') {
    check(s.shiftcareId, caseId, (bd?.weekdayOtAfter2 || 0) > 0, `ot2=${bd?.weekdayOtAfter2}`);
  } else if (caseId === 'I-01b') {
    check(s.shiftcareId, caseId, data.sleepoversCount >= 1, `sleepovers=${data.sleepoversCount}`);
  } else if (caseId === 'J-02b') {
    check(s.shiftcareId, caseId, (bd?.shortTurnaroundHours || 0) === 8, `turnaround=${bd?.shortTurnaroundHours}`);
  } else if (caseId === 'P-03') {
    check(s.shiftcareId, caseId, data.mealAllowanceCount >= 1, `meals=${data.mealAllowanceCount}`);
  } else if (caseId === 'P-06') {
    check(s.shiftcareId, caseId, data.mealAllowanceCount >= 2, `meals=${data.mealAllowanceCount}`);
  }
}

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);

console.log(`\nSCHADS test timesheet validation (UAT engine)`);
console.log(`CSV: ${csvPath}`);
console.log(`Shifts parsed: ${shifts.length}`);
console.log(`Spot checks: ${results.length} pass=${pass} fail=${fail.length}`);

if (fail.length) {
  console.log('\nFailures:');
  for (const f of fail) {
    console.log(`  [${f.id}] ${f.label}: ${JSON.stringify(f.detail)}`);
  }
}

const outPath = path.join(__dirname, 'output/schads-test-timesheet-validation.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ csvPath, shiftCount: shifts.length, results, pass, fail: fail.length }, null, 2));
console.log(`Report: ${outPath}`);

process.exit(fail.length > 0 ? 1 : 0);
