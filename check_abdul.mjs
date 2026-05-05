import fs from 'fs';
import { parseShiftCsvBuffer, detectBrokenShifts } from './backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from './backend/modules/pay-hours/services/payHoursCalculator.js';

const csvPath = '/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-05-05-00-42.csv';
const { shifts: raw } = parseShiftCsvBuffer(fs.readFileSync(csvPath));
const shifts = detectBrokenShifts(raw).filter(s => s.staffName.includes('Abdullateef'));
let n = 0;
for (const s of shifts) s._id = `csv-${++n}`;
const { data, shiftBreakdowns } = computePayHoursForStaff(shifts, new Set(['2026-04-25']));
for (const bd of shiftBreakdowns.values()) {
  console.log(`${bd.shiftStart.toISOString()} - ${bd.shiftEnd.toISOString()} (${bd.shiftType}, ${bd.totalHours}h)`);
  console.log(`  Morning: ${bd.morningHours}, Aft: ${bd.afternoonHours}, Night: ${bd.nightHours}`);
  console.log(`  Sat: ${bd.saturdayHours}, Sun: ${bd.sundayHours}, Hol: ${bd.holidayHours}`);
}
