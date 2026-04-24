/**
 * Holiday Service — Set<"YYYY-MM-DD"> for pay hours calculator.
 * Holidays are stored as year-independent rules (month+day) or named rules
 * (Easter, nth Monday in month, etc.) and materialised for each year in range.
 */

import { Holiday } from './holiday.model.js';
import { holidayToYmdUTC, ymdUTC } from './holidayRule.service.js';

function ymdToUtcTime(ymd) {
  const [Y, M, D] = ymd.split('-').map(Number);
  return new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0)).getTime();
}

/**
 * @param {string|ObjectId} locationId
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Set<string>>}
 */
export async function getHolidaysInRange(locationId, startDate, endDate) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  const holidays = await Holiday.find({ location: locationId }).lean();
  const holidaySet = new Set();
  const startT = start.getTime();
  const endT = end.getTime();
  const startY = start.getUTCFullYear();
  const endY = end.getUTCFullYear();

  for (const h of holidays) {
    const isLegacy = h.date && h.month == null && !h.rule;
    if (isLegacy) {
      const d = new Date(h.date);
      const ymd = ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      const t = ymdToUtcTime(ymd);
      if (t >= startT && t <= endT) holidaySet.add(ymd);
      continue;
    }

    for (let y = startY; y <= endY; y++) {
      const ymd = holidayToYmdUTC(h, y);
      if (!ymd) continue;
      const t = ymdToUtcTime(ymd);
      if (t >= startT && t <= endT) holidaySet.add(ymd);
    }
  }

  return holidaySet;
}
