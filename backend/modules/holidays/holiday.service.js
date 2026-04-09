/**
 * Holiday Service
 *
 * Mirrors the KC Studio pattern from:
 *   kc_studio/app/holidays/services/holiday_service.py → get_holidays_in_range()
 *
 * Provides a pure data-access function that returns a Set<"YYYY-MM-DD"> of holiday
 * dates within a given UTC date range for a specific location. Callers (pay hours
 * orchestrator) pass this set directly to the calculator for O(1) holiday lookups
 * per shift segment.
 *
 * Holiday dates are stored as UTC midnight in MongoDB. The calculator compares against
 * local-time date strings (via toLocal() + offsetStr), so holidays stored on the correct
 * calendar date will always match correctly regardless of timezone offset.
 */

import { Holiday } from './holiday.model.js';

/**
 * Build a Set of "YYYY-MM-DD" holiday strings for fast lookup.
 * Mirrors: kc_studio get_holidays_in_range(location, start_date, end_date)
 *
 * @param {string|ObjectId} locationId - Location to filter holidays by
 * @param {Date} startDate - Start of the period (inclusive)
 * @param {Date} endDate   - End of the period (inclusive)
 * @returns {Promise<Set<string>>} Set of "YYYY-MM-DD" strings
 */
export async function getHolidaysInRange(locationId, startDate, endDate) {
  // Normalise bounds to midnight UTC so the range query is inclusive of full days
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  const holidays = await Holiday.find({
    location: locationId,
    date: { $gte: start, $lte: end },
  })
    .select('date')
    .lean();

  const holidaySet = new Set(
    holidays.map(h => {
      const d = new Date(h.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    })
  );

  return holidaySet;
}
