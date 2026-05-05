import { computePayHoursForStaff } from './backend/modules/pay-hours/services/payHoursCalculator.js';

function toUtc(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00.000Z`);
  d.setHours(d.getHours() - 10);
  return d.toISOString();
}

const s1 = { _id: '1', shiftType: 'personal_care', startDatetime: toUtc('2026-04-07', '08:00'), endDatetime: toUtc('2026-04-07', '12:00'), hours: 4, timezoneOffset: '+10:00', isBrokenShift: false };
const s2 = { _id: '2', shiftType: 'personal_care', startDatetime: toUtc('2026-04-07', '21:00'), endDatetime: toUtc('2026-04-07', '23:00'), hours: 2, timezoneOffset: '+10:00', isBrokenShift: true };

const { data } = computePayHoursForStaff([s1, s2], new Set());
console.log(`Global Data: OT2 = ${data.weekdayOtAfter2}, Morn = ${data.morningHours}, Aft = ${data.afternoonHours}, Night = ${data.nightHours}`);
console.log(`Total hours in buckets: ${data.weekdayOtAfter2 + data.morningHours + data.afternoonHours + data.nightHours}`);
