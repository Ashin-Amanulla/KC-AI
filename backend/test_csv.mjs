// Test Charmain Fernandez shifts from CSV file
import { computePayHoursForStaff } from '/home/cntrlx/Code/Xyvin/KCXyvin/kcai/backend/modules/pay-hours/services/payHoursCalculator.js';
import { parse } from 'csv-parse/sync';

import { readFileSync } from 'fs';

// Read CSV file
const csvFile = '/home/cntrlx/Code/Xyvin/KCXyvin/kcai/tmp/test/Scheduler_Timesheet_Export_2026-05-05-00-42.csv';
const csvContent = readFileSync(csvFile, 'utf8');

// Parse CSV
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

// Filter for Charmain Fernandez
const charmainShifts = records.filter(r => r.Staff === 'Charmain Fernandez');

console.log('=== Charmain Fernandez Shifts from CSV ===');
console.log('Total shifts:', charmainShifts.length);
console.log('');

// Convert to calculator format
const shifts = charmainShifts.map((r, i) => {
  const startStr = r['Start Date Time'];
  const endStr = r['End Date Time'];
  
  // Parse "2026-04-21 12:00:00 +1000" format
  const parseBrisbaneTime = (str) => {
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+\+(\d{4})/);
    if (!match) return null;
    const [, year, mon, day, hour, min, sec, offset] = match;
    // Convert +1000 to +10:00
    const offsetStr = `+${offset.slice(0, 2)}:${offset.slice(2)}`;
    // Brisbane time to UTC
    const localHour = parseInt(hour, 10);
    const localMin = parseInt(min, 10);
    const utc = new Date(Date.UTC(
      parseInt(year, 10), parseInt(mon, 10) - 1, parseInt(day, 10),
      localHour - 10, localMin, parseInt(sec, 10)
    ));
    return { utc, offsetStr };
  };
  
  const start = parseBrisbaneTime(startStr);
  const end = parseBrisbaneTime(endStr);
  
  if (!start || !end) {
    console.log(`WARN: Could not parse shift ${i}: ${startStr} - ${endStr}`);
    return null;
  }
  
  return {
    _id: `csv_${i}`,
    staffName: r.Staff,
    clientName: r['Client Name'] || r.Name,
    startDatetime: start.utc,
    endDatetime: end.utc,
    hours: parseFloat(r['Hours']) || 0,
    shiftType: r['Shift Type']?.toLowerCase().replace(' ', '_') || 'personal_care',
    isBrokenShift: false,
    dayOfWeek: -1, // Will be computed by calculator
    timezoneOffset: start.offsetStr,
  };
}).filter(Boolean);

console.log('Shifts to process:', shifts.length);
const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0);
console.log('Total hours:', totalHours);
console.log('');

const holidays = new Set(['2026-04-25']); // ANZAC Day
const result = computePayHoursForStaff(shifts, holidays);

console.log('=== Calculator Result ===');
console.log(JSON.stringify(result.data, null, 2));
console.log('');

console.log('=== Comparison to User Numbers ===');
console.log('User: Afternoon Shift 10, Calculator afternoonHours:', result.data.afternoonHours);
console.log('User: Double Time Hour 6.75, Calculator morningHours:', result.data.morningHours);
console.log('User: Night Shift 10, Calculator nightHours:', result.data.nightHours);
console.log('User: Sunday 20, Calculator sundayHours:', result.data.sundayHours);
console.log('User: OT After 2 Hours 6, Calculator weekdayOtAfter2:', result.data.weekdayOtAfter2);
console.log('User: OT First 2 Hours 2, Calculator weekdayOtUpto2:', result.data.weekdayOtUpto2);
console.log('User: Broken Shift Allowance 1, Calculator brokenShiftCount:', result.data.brokenShiftCount);
console.log('User: OT Meal Allowance 2, Calculator mealAllowanceCount:', result.data.mealAllowanceCount);
