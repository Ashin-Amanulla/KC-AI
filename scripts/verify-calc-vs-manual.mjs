/**
 * Verifies calcGrossFromRates against an independent mirror of the same formula.
 * Also compares to payroll "Earnings" for one staff (optional).
 *
 * Run: node scripts/verify-calc-vs-manual.mjs [csv] [payroll.xlsx] [staff-rates.xlsx] "Staff Name"
 */
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import {
  calcGrossFromRates,
  normName,
  r2,
  VEHICLE_RATE,
  BROKEN_ALLOWANCE_2,
  effectiveSleepoverRate,
} from '../frontend/src/lib/schadsWageCalc.js';
import { loadStaffRatesMap } from './lib/staffRatesFromXlsx.mjs';

const XLSX = require('../frontend/node_modules/xlsx/xlsx.js');

const DEFAULT_CSV = '/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-04-24-01-37.csv';
const DEFAULT_PAY = '/home/cntrlx/Downloads/Payroll Employee Summary - FN ending 19th April (2).xlsx';
const DEFAULT_RATES = '/home/cntrlx/Downloads/Support Staff Rates.xlsx';
const DEFAULT_STAFF = 'Aini-Alem Goitom';

/** Independent mirror of `calcGrossFromRates` in schadsWageCalc.js (must match line-by-line). */
function manualGrossFromRatesMirror(ph, rates) {
  if (!rates) return null;
  const ot76Wd = ph.otAfter76Weekday || 0;
  const ot76Sat = ph.otAfter76Saturday || 0;
  const sunAll = (ph.sundayHours || 0) + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0);
  const holAll = (ph.holidayHours || 0) + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0);
  const ot76WdT1 = r2(Math.min(ot76Wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76Wd - 2));
  const ot76SatT1 = r2(Math.min(ot76Sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76Sat - 2));

  const mealAllow = r2((ph.mealAllowanceCount || 0) * rates.mealAllow);
  const mileageAllow = r2((ph.totalKm || 0) * (rates.kmRate || VEHICLE_RATE));

  const pay = r2(
    (ph.morningHours || 0) * rates.daytime +
      (ph.afternoonHours || 0) * rates.afternoon +
      (ph.nightHours || 0) * rates.night +
      (ph.weekdayOtUpto2 || 0) * rates.otUpto2 +
      (ph.weekdayOtAfter2 || 0) * rates.otAfter2 +
      (ph.saturdayHours || 0) * rates.saturday +
      (ph.saturdayOtUpto2 || 0) * rates.otUpto2 +
      (ph.saturdayOtAfter2 || 0) * rates.satOtAfter2 +
      sunAll * rates.sunday +
      holAll * rates.ph +
      (ph.nursingCareHours || 0) * rates.daytime +
      ot76WdT1 * rates.otUpto2 +
      ot76WdT2 * rates.otAfter2 +
      ot76SatT1 * rates.otUpto2 +
      ot76SatT2 * rates.satOtAfter2 +
      (ph.otAfter76Sunday || 0) * rates.sunday +
      (ph.otAfter76Holiday || 0) * rates.ph +
      (ph.brokenShiftCount || 0) * rates.brokenShift +
      (ph.brokenShift2BreakCount || 0) * BROKEN_ALLOWANCE_2 +
      (ph.sleepoversCount || 0) * effectiveSleepoverRate(rates) +
      mealAllow +
      mileageAllow
  );
  return pay;
}

function loadPayrollEarnings(buf, targetNorm) {
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
  if (headerIdx < 0) return null;
  const headers = rows[headerIdx].map((c) => c?.toString().toLowerCase());
  const empIdx = headers.indexOf('employee');
  const earnIdx = headers.indexOf('earnings');
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][empIdx]?.toString().trim();
    if (normName(name) === targetNorm) {
      return { name, earnings: parseFloat(rows[i][earnIdx]) };
    }
  }
  return null;
}

function main() {
  const csv = process.argv[2] || DEFAULT_CSV;
  const payX = process.argv[3] || DEFAULT_PAY;
  const ratesX = process.argv[4] || DEFAULT_RATES;
  const staffQ = process.argv[5] || DEFAULT_STAFF;

  if (!fs.existsSync(csv) || !fs.existsSync(payX) || !fs.existsSync(ratesX)) {
    console.error('Missing file(s)');
    process.exit(1);
  }

  const staffNorm = normName(staffQ);
  const { shifts: raw } = parseShiftCsvBuffer(fs.readFileSync(csv));
  const shifts = detectBrokenShifts(raw);
  let n = 0;
  for (const s of shifts) s._id = s._id || `v-${++n}`;

  const staffShifts = shifts.filter((s) => normName(s.staffName) === staffNorm);
  if (!staffShifts.length) {
    console.error('No shifts for', staffQ);
    process.exit(1);
  }
  staffShifts.sort((a, b) => a.startDatetime - b.startDatetime);

  const staffRatesMap = loadStaffRatesMap(fs.readFileSync(ratesX), { normName, r2, VEHICLE_RATE });
  const rates = staffRatesMap.get(staffNorm);
  if (!rates) {
    console.error('No staff rates row for', staffQ);
    process.exit(1);
  }

  const holidaySet = new Set();
  const { data } = computePayHoursForStaff(staffShifts, holidaySet);
  const totalKm = staffShifts.reduce((s, x) => s + (x.mileage || 0), 0);
  const ph = { ...data, totalKm, staffName: staffQ };

  const g1 = calcGrossFromRates(ph, rates);
  const g2 = manualGrossFromRatesMirror(ph, rates);
  const diffImpl = g1 != null && g2 != null ? r2(g1 - g2) : null;

  const payroll = loadPayrollEarnings(fs.readFileSync(payX), staffNorm);

  console.log('Staff:', staffQ);
  console.log('calcGrossFromRates:', g1, '| manualMirror:', g2, '| diff:', diffImpl, '| match:', diffImpl === 0);
  if (payroll) console.log('Payroll file earnings:', payroll.earnings, '| vs gross:', r2(payroll.earnings - g1));
}

main();
